// src/game/Car.js
import * as THREE from "three";
import { RAPIER } from "../physics/WorldPhysics.js";

export class Car {
    /**
     * @param {import("../physics/WorldPhysics.js").WorldPhysics} physics
     * @param {THREE.Scene} scene
     */
    constructor(physics, scene) {
        this.physics = physics;
        this.world = physics.world;
        this.scene = scene;

        // ---- public group ----
        this.group = new THREE.Group();
        this.scene.add(this.group);

        // -------- tuning ----------
        this.maxEngineForce = 40;
        this.maxBrakeForce = 40;
        this.maxSteer = 0.7; // ~30°
        this.suspensionRestLength = 0.35;
        this.wheelRadius = 0.5;

        // -------- chassis body ----------
        const halfExtents = { x: 1.0, y: 0.35, z: 2.0 }; // Rapier cuboid half-sizes

        const rbDesc = RAPIER.RigidBodyDesc.dynamic()
            .setTranslation(0, 5, 0)
            .setLinearDamping(0.1)
            .setAngularDamping(0.5)
            .setCanSleep(false);

        this.chassisBody = this.world.createRigidBody(rbDesc);

        // lower collider so COM is lower (less flipping)
        const colDesc = RAPIER.ColliderDesc.cuboid(
            halfExtents.x,
            halfExtents.y,
            halfExtents.z
        )
            .setTranslation(0, -0.25, 0)
            .setFriction(1.0);

        this.world.createCollider(colDesc, this.chassisBody);

        // -------- chassis mesh ----------
        const chassisGeo = new THREE.BoxGeometry(
            halfExtents.x * 2,
            halfExtents.y * 2,
            halfExtents.z * 2
        );
        const chassisMat = new THREE.MeshStandardMaterial({ color: 0x3366ff });
        this.chassisMesh = new THREE.Mesh(chassisGeo, chassisMat);
        this.chassisMesh.castShadow = true;
        this.chassisMesh.receiveShadow = true;
        // IMPORTANT: add to group, not scene directly
        this.group.add(this.chassisMesh);

        // -------- vehicle controller (DynamicRayCastVehicleController under the hood) ----------
        this.vehicle = this.world.createVehicleController(this.chassisBody);

        // axes: 0=x, 1=y, 2=z
        this.vehicle.indexUpAxis = 1; // Y up
        this.vehicle.setIndexForwardAxis = 2; // Z forward (+Z)

        const directionCs = new RAPIER.Vector3(0, -1, 0); // suspension down
        const axleCs = new RAPIER.Vector3(-1, 0, 0); // wheel rotates around -X

        const yConn = -0.1;
        const xOff = halfExtents.x + 0.25;
        const zOff = halfExtents.z - 0.2;

        // 0 = FL, 1 = FR, 2 = RL, 3 = RR (in chassis local space)
        const wheels = [
            { pos: new RAPIER.Vector3(+xOff, yConn, +zOff), steering: true }, // FL
            { pos: new RAPIER.Vector3(-xOff, yConn, +zOff), steering: true }, // FR
            { pos: new RAPIER.Vector3(+xOff, yConn, -zOff), steering: false }, // RL
            { pos: new RAPIER.Vector3(-xOff, yConn, -zOff), steering: false }, // RR
        ];
        this.wheels = wheels;

        wheels.forEach(({ pos }) => {
            this.vehicle.addWheel(
                pos,
                directionCs,
                axleCs,
                this.suspensionRestLength,
                this.wheelRadius
            );
        });

        const numWheels = this.vehicle.numWheels();
        for (let i = 0; i < numWheels; i++) {
            this.vehicle.setWheelSuspensionRestLength(
                i,
                this.suspensionRestLength
            );
            this.vehicle.setWheelSuspensionStiffness(i, 40.0);
            this.vehicle.setWheelSuspensionCompression(i, 4.0);
            this.vehicle.setWheelSuspensionRelaxation(i, 6.0);

            this.vehicle.setWheelMaxSuspensionForce(i, 1500);
            this.vehicle.setWheelMaxSuspensionTravel(i, 0.4);

            this.vehicle.setWheelFrictionSlip(i, 6.0); // traction
            this.vehicle.setWheelSideFrictionStiffness(i, 3.0); // sideways grip

            this.vehicle.setWheelBrake(i, 0);
            this.vehicle.setWheelEngineForce(i, 0);
            this.vehicle.setWheelSteering(i, 0);
        }

        // -------- wheel meshes (children of group) ----------
        this.wheelMeshes = [];
        const wheelGeo = new THREE.CylinderGeometry(
            this.wheelRadius,
            this.wheelRadius,
            0.4,
            16
        );
        wheelGeo.rotateZ(Math.PI / 2); // roll along Z

        const wheelMat = new THREE.MeshStandardMaterial({ color: 0x111111 });

        for (let i = 0; i < numWheels; i++) {
            const mesh = new THREE.Mesh(wheelGeo, wheelMat);
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            this.group.add(mesh); // add wheels into the group
            this.wheelMeshes.push(mesh);
        }

        // per-wheel rolling angle
        this.wheelAngles = new Array(numWheels).fill(0);

        // -------- input state ----------
        this.keys = {};
        this.engineInput = 0;
        this.steerInput = 0;
        this.brakeInput = 0;

        window.addEventListener("keydown", (e) => {
            this.keys[e.code] = true;
        });
        window.addEventListener("keyup", (e) => {
            this.keys[e.code] = false;
        });
    }

    handleInput() {
        const k = this.keys;
        let engine = 0;
        let steer = 0;
        let brake = 0;

        if (k["KeyW"]) engine += 1;
        if (k["KeyS"]) engine -= 1;
        if (k["KeyA"]) steer += 1;
        if (k["KeyD"]) steer -= 1;
        if (k["Space"]) brake = 1;

        this.engineInput = engine;
        this.steerInput = steer;
        this.brakeInput = brake;
    }

    update(dt) {
        this.handleInput();

        const numWheels = this.vehicle.numWheels();
        const engineForce = this.maxEngineForce * this.engineInput;
        const steerAngle = this.maxSteer * this.steerInput;
        const brakeForce = this.brakeInput ? this.maxBrakeForce : 0;

        for (let i = 0; i < numWheels; i++) {
            // rear-wheel drive
            if (i >= 2) this.vehicle.setWheelEngineForce(i, engineForce);
            else this.vehicle.setWheelEngineForce(i, 0);

            console.log(steerAngle);
            // front steering
            if (i === 0) this.vehicle.setWheelSteering(i, steerAngle); // FL
            else if (i === 1)
                this.vehicle.setWheelSteering(i, steerAngle); // FR
            else this.vehicle.setWheelSteering(i, 0);

            this.vehicle.setWheelBrake(i, brakeForce);
        }

        // apply forces to chassis
        this.vehicle.updateVehicle(dt);

        // -------- sync transforms --------
        const p = this.chassisBody.translation();
        const r = this.chassisBody.rotation();

        // set group to chassis transform
        this.group.position.set(p.x, p.y, p.z);
        this.group.quaternion.set(r.x, r.y, r.z, r.w);

        // world-space chassis transform for local conversion
        const chassisPos = new THREE.Vector3(p.x, p.y, p.z);
        const chassisQuat = new THREE.Quaternion(r.x, r.y, r.z, r.w);
        const invChassisQuat = chassisQuat.clone().invert();

        // get chassis linear velocity in local space to compute wheel rolling speed
        const linvel = this.chassisBody.linvel();
        const vWorld = new THREE.Vector3(linvel.x, linvel.y, linvel.z);
        const vLocal = vWorld.clone().applyQuaternion(invChassisQuat);
        const forwardSpeed = vLocal.z; // +Z is forward
        const wheelAngularVel = forwardSpeed / this.wheelRadius; // rad/s

        for (let i = 0; i < numWheels; i++) {
            const hp = this.vehicle.wheelHardPoint(i);
            const len = this.vehicle.wheelSuspensionLength(i);

            const wx = hp.x;
            const wy = hp.y - len;
            const wz = hp.z;

            const worldPos = new THREE.Vector3(wx, wy, wz);
            const localPos = worldPos
                .clone()
                .sub(chassisPos)
                .applyQuaternion(invChassisQuat);

            const mesh = this.wheelMeshes[i];
            mesh.position.copy(localPos);

            // --- update rolling angle ---
            this.wheelAngles[i] += wheelAngularVel * dt;

            // if it is as steering wheel, apply steer rotation
            if (this.wheels[i].steering) {
                const qSteer = new THREE.Quaternion().setFromAxisAngle(
                    new THREE.Vector3(0, 1, 0),
                    steerAngle
                );
                mesh.quaternion.copy(qSteer);
            }
        }
    }
}
