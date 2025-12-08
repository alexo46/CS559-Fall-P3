import * as THREE from "three";
import { PIDController } from "../ai/PIDController.js";

const tmpForward = new THREE.Vector3();
const tmpDesired = new THREE.Vector3();
const tmpCross = new THREE.Vector3();

export class AIDriver {
    constructor({
        waypoints = [],
        waypointAdvanceDistance = 10,
        targetSpeedMph = 40,
        steerPid = { kp: 1.2, ki: 0, kd: 0.35, integralClamp: 0.5 },
        speedPid = { kp: 0.6, ki: 0.15, kd: 0, integralClamp: 1 },
    } = {}) {
        if (!Array.isArray(waypoints) || waypoints.length < 2) {
            throw new Error("AIDriver requires at least two waypoints");
        }

        this.waypoints = waypoints.map((p) => p.clone());
        this.advanceDistanceSq = waypointAdvanceDistance ** 2;
        this.targetSpeedMph = targetSpeedMph;
        this.currentIndex = 0;
        this.steerController = new PIDController(steerPid);
        this.speedController = new PIDController(speedPid);
    }

    nextWaypoint(position) {
        const target = this.waypoints[this.currentIndex];
        if (!target) return null;

        if (position.distanceToSquared(target) <= this.advanceDistanceSq) {
            this.currentIndex = (this.currentIndex + 1) % this.waypoints.length;
            return this.waypoints[this.currentIndex];
        }
        return target;
    }

    update(car, dt) {
        if (!car) return { engine: 0, steer: 0, brake: 1 };

        const carPos = car.group.position;
        const waypoint = this.nextWaypoint(carPos.clone());
        if (!waypoint) {
            return { engine: 0, steer: 0, brake: 1 };
        }

        tmpForward
            .set(0, 0, 1)
            .applyQuaternion(car.group.quaternion)
            .normalize();
        tmpDesired.copy(waypoint).sub(carPos);
        if (tmpDesired.lengthSq() === 0) {
            return { engine: 0, steer: 0, brake: 1 };
        }
        tmpDesired.normalize();

        const dot = THREE.MathUtils.clamp(tmpForward.dot(tmpDesired), -1, 1);
        tmpCross.copy(tmpForward).cross(tmpDesired);
        const headingError = Math.atan2(tmpCross.y, dot);
        const steerCmd = this.steerController.update(headingError, dt);

        const speedError = this.targetSpeedMph - car.getCarMph();
        const accelCmd = this.speedController.update(speedError, dt);

        const engine = THREE.MathUtils.clamp(Math.max(0, accelCmd), 0, 1);
        const brake = THREE.MathUtils.clamp(Math.max(0, -accelCmd), 0, 1);
        const steer = THREE.MathUtils.clamp(steerCmd, -1, 1);

        return { engine, steer, brake };
    }
}
