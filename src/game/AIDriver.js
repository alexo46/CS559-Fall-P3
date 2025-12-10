import * as THREE from "three";
import { PIDController } from "../ai/PIDController.js";
import { RAPIER } from "../physics/WorldPhysics.js";

const tmpForward = new THREE.Vector3();
const tmpDesired = new THREE.Vector3();
const tmpCross = new THREE.Vector3();
const tmpToPlayer = new THREE.Vector3();
const tmpSegment = new THREE.Vector3();
const tmpProjection = new THREE.Vector3();
const tmpDir = new THREE.Vector3();
const tmpNext = new THREE.Vector3();

export class AIDriver {
    constructor({
        waypoints = [],
        waypointAdvanceDistance = 10,
        targetSpeedMph = 40,
        lookAheadDistance = 20,
        steerPid = { kp: 1.0, ki: 0, kd: 0.4, integralClamp: 0.5 },
        speedPid = { kp: 0.6, ki: 0.05, kd: 0.05, integralClamp: 1 },
        playerCar = null,
        avoidanceDistance = 12,
        avoidanceStrength = 0.5,
        physicsWorld = null,
        wallDetectionDistance = 8,
    } = {}) {
        if (!Array.isArray(waypoints) || waypoints.length < 2) {
            throw new Error("AIDriver requires at least two waypoints");
        }

        this.waypoints = waypoints.map((p) => p.clone());
        this.advanceDistance = waypointAdvanceDistance;
        this.advanceDistanceSq = waypointAdvanceDistance ** 2;
        this.targetSpeedMph = targetSpeedMph;
        this.lookAheadDistance = lookAheadDistance;
        this.currentIndex = 0;
        this.steerController = new PIDController(steerPid);
        this.speedController = new PIDController(speedPid);
        this.playerCar = playerCar;
        this.avoidanceDistance = avoidanceDistance;
        this.avoidanceDistanceSq = avoidanceDistance * avoidanceDistance;
        this.avoidanceStrength = avoidanceStrength;
        this.physicsWorld = physicsWorld;
        this.wallDetectionDistance = wallDetectionDistance;
        this.lookAheadPoint = new THREE.Vector3();

        // debug
        this.debugCurrentTarget = null;
        this.debugLookAhead = null;
    }

    setPlayerCar(playerCar) {
        this.playerCar = playerCar;
    }

    /**
     * Initialize starting waypoint index based on car position and forward direction
     */
    initializeWaypointIndex(carPosition, carForward) {
        if (!this.waypoints.length) return;
        this.currentIndex = this.findForwardWaypointIndex(
            carPosition,
            carForward
        );
    }

    findForwardWaypointIndex(position, forward) {
        if (!this.waypoints.length) return 0;

        let bestIdx = this.currentIndex;
        let bestScore = -Infinity;

        for (let i = 0; i < this.waypoints.length; i++) {
            const wp = this.waypoints[i];
            tmpDir.copy(wp).sub(position);
            const distSq = tmpDir.lengthSq();
            if (distSq < 0.25) continue;

            const dist = Math.sqrt(distSq);
            tmpDir.multiplyScalar(1 / dist);
            const forwardDot = forward.dot(tmpDir);
            if (forwardDot < 0.1) continue;

            const score = forwardDot * (120 / dist);
            if (score > bestScore) {
                bestScore = score;
                bestIdx = i;
            }
        }

        return bestScore > -Infinity ? bestIdx : this.currentIndex;
    }

    nextWaypoint(position, carForward = null) {
        if (!this.waypoints.length) return null;

        // If we have forward direction, only consider forward waypoints
        if (carForward) {
            let bestIdx = this.currentIndex;
            let bestScore = -Infinity;

            // Check waypoints forward from current index
            for (let i = 0; i < this.waypoints.length; i++) {
                const idx = (this.currentIndex + i) % this.waypoints.length;
                const wp = this.waypoints[idx];
                const toWp = new THREE.Vector3().subVectors(wp, position);
                const distSq = toWp.lengthSq();
                const dist = Math.sqrt(distSq);

                if (dist < 0.1) continue;

                toWp.normalize();
                const forwardDot = carForward.dot(toWp);

                // Only consider waypoints in front (forwardDot > 0.2)
                if (forwardDot < 0.2) continue;

                // Score: prefer closer forward waypoints
                const score = forwardDot * (100 / dist);

                if (score > bestScore) {
                    bestScore = score;
                    bestIdx = idx;
                }

                // Stop searching if we've gone too far forward
                if (dist > this.lookAheadDistance * 2) break;
            }

            // Only update if we found a valid forward waypoint
            if (bestScore > 0) {
                this.currentIndex = bestIdx;
            }
        } else {
            // Fallback: find nearest waypoint
            let nearestIdx = this.currentIndex;
            let nearestDist = Infinity;
            for (let i = 0; i < this.waypoints.length; i++) {
                const d = position.distanceToSquared(this.waypoints[i]);
                if (d < nearestDist) {
                    nearestDist = d;
                    nearestIdx = i;
                }
            }
            this.currentIndex = nearestIdx;
        }

        const target = this.waypoints[this.currentIndex];
        if (!target) return null;

        tmpDesired.copy(target).sub(position);
        const distSq = tmpDesired.lengthSq();

        if (carForward && distSq > this.advanceDistanceSq && distSq > 0.0001) {
            const toTargetDir = tmpDir.copy(tmpDesired).normalize();
            if (carForward.dot(toTargetDir) < -0.2) {
                this.currentIndex =
                    (this.currentIndex + 1) % this.waypoints.length;
                return this.waypoints[this.currentIndex];
            }
        }

        if (distSq <= this.advanceDistanceSq) {
            const nextIdx = (this.currentIndex + 1) % this.waypoints.length;
            const nextWp = this.waypoints[nextIdx];
            tmpNext.copy(nextWp).sub(position);
            if (tmpNext.lengthSq() > 0.0001) {
                tmpNext.normalize();
            }

            if (!carForward || carForward.dot(tmpNext) > 0.1) {
                this.currentIndex = nextIdx;
                return this.waypoints[this.currentIndex];
            }
        }
        return target;
    }

    projectPointOnSegment(point, start, end, out) {
        tmpSegment.copy(end).sub(start);
        const segLenSq = tmpSegment.lengthSq();
        if (segLenSq === 0) {
            out.copy(start);
            return 0;
        }

        tmpProjection.copy(point).sub(start);
        const t = THREE.MathUtils.clamp(
            tmpProjection.dot(tmpSegment) / segLenSq,
            0,
            1
        );

        out.copy(start).addScaledVector(tmpSegment, t);
        return t;
    }

    findLookAheadPoint(position) {
        const total = this.waypoints.length;
        if (!total) return null;

        const lookPoint = this.lookAheadPoint;
        const prevIdx = (this.currentIndex - 1 + total) % total;
        const prev = this.waypoints[prevIdx];
        const current = this.waypoints[this.currentIndex];

        this.projectPointOnSegment(position, prev, current, lookPoint);

        let remaining = this.lookAheadDistance;
        const distToCurrent = current.distanceTo(lookPoint);

        if (distToCurrent >= remaining && distToCurrent > 0.0001) {
            tmpDir.copy(current).sub(lookPoint).setLength(remaining);
            lookPoint.add(tmpDir);
            return lookPoint;
        }

        remaining -= distToCurrent;
        let idx = this.currentIndex;

        for (let i = 0; i < total && remaining > 0; i++) {
            const nextIdx = (idx + 1) % total;
            const segStart = this.waypoints[idx];
            const segEnd = this.waypoints[nextIdx];
            const segLen = segStart.distanceTo(segEnd);

            if (segLen < 0.001) {
                idx = nextIdx;
                continue;
            }

            if (remaining <= segLen) {
                tmpDir.copy(segEnd).sub(segStart).setLength(remaining);
                lookPoint.copy(segStart).add(tmpDir);
                return lookPoint;
            }

            remaining -= segLen;
            idx = nextIdx;
        }

        lookPoint.copy(current);
        return lookPoint;
    }

    calculateAvoidance(carPos, carForward) {
        if (!this.playerCar) return 0;
        const playerPos = this.playerCar.group.position;
        tmpToPlayer.copy(playerPos).sub(carPos);
        const distSq = tmpToPlayer.lengthSq();
        if (distSq > this.avoidanceDistanceSq || distSq < 0.001) return 0;

        const dist = Math.sqrt(distSq);
        tmpToPlayer.normalize();
        const forwardDot = carForward.dot(tmpToPlayer);
        if (forwardDot < 0) return 0; // only if player ahead

        tmpCross.copy(carForward).cross(tmpToPlayer);
        const side = Math.sign(tmpCross.y);
        const distanceFactor = 1 - dist / this.avoidanceDistance;
        const angleFactor = Math.abs(forwardDot);
        const avoid =
            side * distanceFactor * angleFactor * this.avoidanceStrength;
        return THREE.MathUtils.clamp(avoid, -1, 1);
    }

    /**
     * Detect walls using raycasting and return steering adjustment
     */
    calculateWallAvoidance(carPos, carForward) {
        if (!this.physicsWorld) return 0;

        let wallSteer = 0;
        const rayLength = this.wallDetectionDistance;

        // Cast rays forward-left, forward-center, and forward-right
        const rayOffsets = [
            { angle: -0.4, weight: 1.5 }, // Left (stronger weight)
            { angle: 0, weight: 1.0 }, // Center
            { angle: 0.4, weight: 1.5 }, // Right (stronger weight)
        ];

        for (const { angle, weight } of rayOffsets) {
            // Rotate forward direction by angle
            const rayDir = new THREE.Vector3(carForward.x, 0, carForward.z);
            const perp = new THREE.Vector3(-rayDir.z, 0, rayDir.x); // perpendicular
            rayDir.addScaledVector(perp, angle).normalize();

            // Cast ray from car position
            const rayOrigin = new RAPIER.Vector3(
                carPos.x,
                carPos.y + 0.5,
                carPos.z
            );
            const rayDirRapier = new RAPIER.Vector3(rayDir.x, 0, rayDir.z);
            const ray = new RAPIER.Ray(rayOrigin, rayDirRapier);

            // Cast ray and get hit
            const hit = this.physicsWorld.castRay(ray, rayLength, true);

            if (hit) {
                const hitDist = hit.toi;
                const dangerFactor = 1 - hitDist / rayLength;

                // Steer away from the wall
                // Left ray hit -> steer right (positive), right ray hit -> steer left (negative)
                const steerAway =
                    -Math.sign(angle) * dangerFactor * weight * 0.7;
                wallSteer += steerAway;
            }
        }

        return THREE.MathUtils.clamp(wallSteer, -1, 1);
    }

    update(car, dt) {
        if (!car) return { engine: 0, steer: 0, brake: 1 };

        const carPos = car.group.position;

        // Get car's forward direction
        tmpForward.set(0, 0, 1).applyQuaternion(car.group.quaternion);
        const forwardXZ = new THREE.Vector3(
            tmpForward.x,
            0,
            tmpForward.z
        ).normalize();

        // Initialize waypoint index on first update if needed
        if (this.currentIndex === 0 && this.waypoints.length > 0) {
            this.initializeWaypointIndex(carPos, forwardXZ);
        }

        // If current waypoint drifts behind the car, reacquire a forward one
        const currentWp = this.waypoints[this.currentIndex];
        if (currentWp) {
            tmpDesired.copy(currentWp).sub(carPos);
            const distSqToCurrent = tmpDesired.lengthSq();
            if (distSqToCurrent > 0.25) {
                const invLen = 1 / Math.sqrt(distSqToCurrent);
                tmpDesired.multiplyScalar(invLen);
                const forwardDotCurrent = forwardXZ.dot(tmpDesired);

                if (forwardDotCurrent < 0.05) {
                    this.currentIndex = this.findForwardWaypointIndex(
                        carPos,
                        forwardXZ
                    );
                }
            }
        }

        // advance to next waypoint if close (pass forward direction)
        this.nextWaypoint(carPos, forwardXZ);

        // pick a look-ahead point along the path for smoother steering
        const lookAheadPoint = this.findLookAheadPoint(carPos);
        if (!lookAheadPoint) return { engine: 0, steer: 0, brake: 1 };

        // debug breadcrumbs
        this.debugCurrentTarget = this.waypoints[this.currentIndex];
        this.debugLookAhead = lookAheadPoint;

        // desired vector to waypoint projected on XZ
        tmpDesired.copy(lookAheadPoint).sub(carPos);
        const distanceToWp = tmpDesired.length();
        if (distanceToWp === 0) return { engine: 0, steer: 0, brake: 1 };
        const desiredXZ = new THREE.Vector3(
            tmpDesired.x,
            0,
            tmpDesired.z
        ).normalize();

        // signed heading error using cross product Y
        tmpCross.copy(forwardXZ).cross(desiredXZ);
        const dot = THREE.MathUtils.clamp(forwardXZ.dot(desiredXZ), -1, 1);
        const headingError = Math.asin(
            THREE.MathUtils.clamp(tmpCross.y, -1, 1)
        );

        let steerCmd = this.steerController.update(headingError, dt);

        // wall avoidance (steer away from walls)
        const wallAvoidance = this.calculateWallAvoidance(carPos, forwardXZ);
        steerCmd += wallAvoidance * 0.6; // Blend with waypoint steering

        // player avoidance (away from player if ahead and close)
        steerCmd += this.calculateAvoidance(carPos, forwardXZ) * 0.4;

        // speed target adjusted for turn sharpness and proximity
        let targetSpeed = this.targetSpeedMph;
        const turnAngle = Math.abs(headingError);

        // Faster on straights: small heading error lets us exceed base speed
        if (turnAngle < 0.12) {
            const straightFactor = THREE.MathUtils.lerp(
                1.0,
                1.3,
                1 - turnAngle / 0.12
            );
            targetSpeed *= straightFactor;
        }

        // Slower in sharp turns
        if (turnAngle > 0.25) {
            const turnFactor = Math.max(0.4, 1 - (turnAngle / Math.PI) * 0.9);
            targetSpeed *= turnFactor;
        }

        // Ease up a bit when very close to the look-ahead point
        if (distanceToWp < 12) {
            const closeFactor = THREE.MathUtils.clamp(
                distanceToWp / 12,
                0.35,
                1
            );
            targetSpeed = Math.min(
                targetSpeed,
                this.targetSpeedMph * closeFactor
            );
        }

        // collision slow-down if player ahead and close
        if (this.playerCar) {
            const playerPos = this.playerCar.group.position;
            tmpToPlayer.copy(playerPos).sub(carPos);
            const distSq = tmpToPlayer.lengthSq();
            const forwardDot = forwardXZ.dot(tmpToPlayer.normalize());
            if (forwardDot > 0.5 && distSq < this.avoidanceDistanceSq) {
                const danger = 1 - Math.sqrt(distSq) / this.avoidanceDistance;
                targetSpeed *= Math.max(0.2, 1 - danger * 0.7);
            }
        }

        const speedError = targetSpeed - car.getCarMph();
        let accelCmd = this.speedController.update(speedError, dt);

        // convert accelCmd to engine/brake
        const engine = THREE.MathUtils.clamp(Math.max(0, accelCmd), 0, 1);
        const brake = THREE.MathUtils.clamp(Math.max(0, -accelCmd), 0, 1);
        const steer = THREE.MathUtils.clamp(steerCmd, -1, 1);

        return { engine, steer, brake };
    }
}
