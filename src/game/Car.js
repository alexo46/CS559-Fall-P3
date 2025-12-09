// src/game/Car.js
import * as THREE from "three";
import { RAPIER } from "../physics/WorldPhysics.js";
import { VehicleDebugPanel } from "../ui/VehicleDebugPanel.js";
import { loadCarModel } from "../assets/models/car/CarModelLoader.js";

export class Car {
    /**
     * @param {import("../physics/WorldPhysics.js").WorldPhysics} physics
     * @param {THREE.Scene} scene
     * @param {boolean} detailed
     */
    constructor(physics, scene, detailed = false, options = {}) {
        const { enableKeyboard = true } = options;

        this.physics = physics;
        this.world = physics.world;
        this.scene = scene;
        this.enableKeyboard = enableKeyboard;

        // ---- public group ----
        this.group = new THREE.Group();
        this.scene.add(this.group);

        this.debugPanel = new VehicleDebugPanel();
        this.debugPanel.visible = true;

        // -------- tuning ----------
        this.maxEngineForce = 500;
        this.maxBrakeForce = 50;
        this.maxSteer = 0.7; // ~30°
        this.suspensionRestLength = 0.35;
        this.wheelRadius = 0.5;
        this.frontWheelForwardOffset = this.wheelRadius * 0.75; // quarter wheel diameter
        this.chassisVisualDrop = this.wheelRadius * 0.7;
        this.leftWheelInwardOffset = this.wheelRadius * 0.75; // nudge left tires toward centerline

        // -------- Engine & Transmission ----------
        this.rpm = 1000;
        this.idleRpm = 1000;
        this.maxRpm = 8000;
        this.currentGear = 1; // -1=R, 0=N, 1=1st...
        this.gearRatios = {
            "-1": 3.0,
            0: 0,
            1: 3.27,
            2: 2.13,
            3: 1.52,
            4: 1.16,
            5: 0.97,
            6: 0.77,
        };
        this.finalDrive = 3.4;
        this.shiftUpRpm = 7200;
        this.shiftDownRpm = 3000;
        this.lastShiftTime = 0;
        this.shiftDuration = 0.2;
        this.engineBaseForce = 1500;
        this.throttleResponseTime = 0.3; // seconds to reach commanded throttle
        this.launchFullSpeedMs = 18; // speed where full torque is available
        this.minLaunchScale = 0.15;
        this.dragCoeff = 0.02;
        this.downforceCoeff = 0.1;
        this.sleepSpeedThreshold = 0.12;
        this.sleepInputThreshold = 0.05;

        // -------- chassis body ----------
        const halfExtents = { x: 1.5, y: 0.35, z: 3.5 }; // Rapier cuboid half-sizes
        this.chassisHalfExtents = halfExtents;

        const rbDesc = RAPIER.RigidBodyDesc.dynamic()
            .setTranslation(0, 5, 0)
            .setLinearDamping(0.1)
            .setAngularDamping(0.5);

        this.chassisBody = this.world.createRigidBody(rbDesc);

        // lower collider so COM is lower (less flipping)
        const colDesc = RAPIER.ColliderDesc.cuboid(
            halfExtents.x,
            halfExtents.y,
            halfExtents.z
        )
            .setTranslation(0, -0.25, 0)
            .setFriction(1.0)
            .setMass(800);

        this.world.createCollider(colDesc, this.chassisBody);

        // const debugGeo = new THREE.BoxGeometry(
        //     halfExtents.x * 2,
        //     halfExtents.y * 2,
        //     halfExtents.z * 2
        // );
        // const debugMat = new THREE.MeshBasicMaterial({
        //     color: 0xff00ff,
        //     wireframe: true,
        //     depthTest: false,
        //     transparent: true,
        //     opacity: 1.0,
        // });
        // this.collisionDebugMesh = new THREE.Mesh(debugGeo, debugMat);
        // this.collisionDebugMesh.position.set(0, 0, 0);
        // this.group.add(this.collisionDebugMesh);
        // this.collisionDebugMesh.visible = true;

        // -------- chassis mesh ----------
        this.chassisMesh = null;

        // -------- vehicle controller (DynamicRayCastVehicleController under the hood) ----------
        this.vehicle = this.world.createVehicleController(this.chassisBody);

        // axes: 0=x, 1=y, 2=z
        this.vehicle.indexUpAxis = 1; // Y up
        this.vehicle.setIndexForwardAxis = 2; // Z forward (+Z)

        const directionCs = new RAPIER.Vector3(0, -1, 0); // suspension down
        const axleCs = new RAPIER.Vector3(-1, 0, 0); // wheel rotates around -X

        const yConn = -0.1;

        // Explicit wheel layout relative to chassis center
        const wheelBase = 3.0; // distance between front and rear axles (Z)
        const trackWidth = 1.8; // distance between left and right wheels (X)
        const halfWheelBase = wheelBase * 0.6;
        const halfTrack = trackWidth * 0.65;

        // 0 = FL, 1 = FR, 2 = RL, 3 = RR (in chassis local space)
        const wheels = [
            {
                pos: new RAPIER.Vector3(+halfTrack, yConn, +halfWheelBase),
                steering: true,
            }, // FL
            {
                pos: new RAPIER.Vector3(-halfTrack, yConn, +halfWheelBase),
                steering: true,
            }, // FR
            {
                pos: new RAPIER.Vector3(+halfTrack, yConn, -halfWheelBase),
                steering: false,
            }, // RL
            {
                pos: new RAPIER.Vector3(-halfTrack, yConn, -halfWheelBase),
                steering: false,
            }, // RR
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
            const isFront = i < 2; // 0,1 = front
            const isRear = !isFront; // 2,3 = rear

            // Same rest length for now
            this.vehicle.setWheelSuspensionRestLength(
                i,
                this.suspensionRestLength
            );

            // Stiffer rear so it doesn't squat and flip
            this.vehicle.setWheelSuspensionStiffness(i, isRear ? 50.0 : 40.0);
            this.vehicle.setWheelSuspensionCompression(i, isRear ? 5.0 : 4.0);
            this.vehicle.setWheelSuspensionRelaxation(i, isRear ? 6.0 : 5.0);

            // Rear can support more load
            this.vehicle.setWheelMaxSuspensionForce(i, isRear ? 4000 : 3000);
            this.vehicle.setWheelMaxSuspensionTravel(i, 0.35);

            // Grip
            this.vehicle.setWheelFrictionSlip(i, 4.0); // Moderate friction
            // Slightly more lateral grip on the front for turn-in
            this.vehicle.setWheelSideFrictionStiffness(i, isFront ? 5.0 : 4.0);

            this.vehicle.setWheelBrake(i, 0);
            this.vehicle.setWheelEngineForce(i, 0);
            this.vehicle.setWheelSteering(i, 0);
        }

        // -------- wheel meshes (children of group) ----------
        this.wheelSlots = [];
        this.wheelSteerPivots = [];
        this.wheelRollPivots = [];
        for (let i = 0; i < numWheels; i++) {
            const slot = new THREE.Group();
            const steerPivot = new THREE.Group();
            const rollPivot = new THREE.Group();

            steerPivot.add(rollPivot);
            slot.add(steerPivot);
            this.group.add(slot);

            this.wheelSlots.push(slot);
            this.wheelSteerPivots.push(steerPivot);
            this.wheelRollPivots.push(rollPivot);
        }

        loadCarModel({ detailed, wheelRadius: this.wheelRadius })
            .then(({ chassisMesh, wheelMeshes }) => {
                if (chassisMesh) {
                    this.chassisMesh = chassisMesh;
                    this.chassisMesh.position.x += 0.1; // shift body slightly left
                    this.chassisMesh.position.y -= this.chassisVisualDrop;
                    this.group.add(chassisMesh);
                }

                if (Array.isArray(wheelMeshes)) {
                    wheelMeshes.forEach((mesh, idx) => {
                        const pivot = this.wheelRollPivots[idx];
                        if (!mesh || !pivot) return;
                        pivot.add(mesh);
                    });
                }
            })
            .catch((error) => {
                console.error("Error loading car model:", error);
            });

        // -------- input state ----------
        this.keys = {};
        this.rawEngineInput = 0;
        this.engineInput = 0;
        this.steerInput = 0;
        this.brakeInput = 0;
        this.controlProvider = null;

        if (this.enableKeyboard) {
            this.keyDownHandler = (e) => {
                this.keys[e.code] = true;

                if (e.code === "F3") {
                    this.debugPanel.visible = !this.debugPanel.visible;
                }

                // Temporarily always show debug mesh while debugging visibility
                // if (e.code === "F4" && this.collisionDebugMesh) {
                //     this.collisionDebugMesh.visible =
                //         !this.collisionDebugMesh.visible;
                // }
            };

            this.keyUpHandler = (e) => {
                this.keys[e.code] = false;
            };

            window.addEventListener("keydown", this.keyDownHandler);
            window.addEventListener("keyup", this.keyUpHandler);
        }
    }

    setControlProvider(provider) {
        this.controlProvider = provider;
    }

    getControlInputs(dt) {
        if (!this.controlProvider) return null;
        if (typeof this.controlProvider === "function") {
            return this.controlProvider(dt) || null;
        }
        return this.controlProvider;
    }

    /**
     * Get the direction of motion of the car in world space (forward if speed 0 or slow)
     * @return {THREE.Vector3} Direction of motion as a normalized vector in world space
     *
     */
    getDirectionofMotion() {
        if (this.chassisBody === null || this.getCarMph() < 2) {
            return new THREE.Vector3(0, 0, 1); // Default forward
        }

        const linvel = this.chassisBody.linvel();
        const direction = new THREE.Vector3(linvel.x, 0, linvel.z).normalize();
        return direction;
    }

    getCarMph() {
        const linvel = this.chassisBody.linvel();
        const speedMs = Math.sqrt(
            linvel.x * linvel.x + linvel.y * linvel.y + linvel.z * linvel.z
        );
        const speedMph = speedMs * 2.23694;
        return speedMph;
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

        this.rawEngineInput = engine;
        this.steerInput = steer;
        this.brakeInput = brake;
    }

    getRPM() {
        return this.rpm;
    }

    getGear() {
        return this.currentGear;
    }

    update(dt) {
        const externalControls = this.getControlInputs(dt);
        let requestedEngineInput = 0;
        if (externalControls) {
            const { engine = 0, steer = 0, brake = 0 } = externalControls;
            requestedEngineInput = THREE.MathUtils.clamp(engine, -1, 1);
            this.steerInput = THREE.MathUtils.clamp(steer, -1, 1);
            this.brakeInput = THREE.MathUtils.clamp(brake, 0, 1);
        } else if (this.enableKeyboard) {
            this.handleInput();
            requestedEngineInput = this.rawEngineInput;
        } else {
            requestedEngineInput = 0;
            this.steerInput = 0;
            this.brakeInput = 0;
        }

        this.rawEngineInput = requestedEngineInput;

        const throttleBlend =
            this.throttleResponseTime > 0 && dt > 0
                ? Math.min(1, dt / this.throttleResponseTime)
                : 1;
        this.engineInput = THREE.MathUtils.lerp(
            this.engineInput,
            this.rawEngineInput,
            throttleBlend
        );

        const time = performance.now() / 1000;

        // 1. Determine Speed & Direction
        const speedMph = this.getCarMph();
        const speedMs = speedMph * 0.44704;

        const gearInput = this.rawEngineInput;

        // 2. Automatic Gearbox Logic
        // Switch to Reverse if stopped and braking
        if (gearInput < 0 && speedMph < 3 && this.currentGear > 0) {
            this.currentGear = -1;
        }
        // Switch to 1st if throttle and in Reverse/Neutral
        else if (gearInput > 0 && this.currentGear <= 0) {
            this.currentGear = 1;
        }

        // Automatic Shifting
        if (this.currentGear > 0 && time - this.lastShiftTime > 0.5) {
            if (this.rpm > this.shiftUpRpm && this.currentGear < 6) {
                this.currentGear++;
                this.lastShiftTime = time;
            } else if (this.rpm < this.shiftDownRpm && this.currentGear > 1) {
                this.currentGear--;
                this.lastShiftTime = time;
            }
        }

        const isShifting = time - this.lastShiftTime < this.shiftDuration;

        const wantsAutoSleep =
            speedMs < this.sleepSpeedThreshold &&
            Math.abs(this.engineInput) < this.sleepInputThreshold &&
            Math.abs(this.steerInput) < this.sleepInputThreshold &&
            Math.abs(this.brakeInput) < this.sleepInputThreshold;

        if (!wantsAutoSleep) {
            this.chassisBody.wakeUp();
        }

        // 3. Calculate RPM
        const wheelRotSpeed = speedMs / this.wheelRadius; // rad/s
        const wheelRpm = wheelRotSpeed * 9.5493; // rad/s to rpm
        const ratio = this.gearRatios[String(this.currentGear)] || 0;

        let targetRpm = Math.abs(wheelRpm * ratio * this.finalDrive);

        // Clutch slip / Idle / Revving in Neutral
        if (targetRpm < this.idleRpm) {
            targetRpm = this.idleRpm;
            // Revving while stopped
            if (Math.abs(speedMph) < 1.5 && this.engineInput !== 0) {
                targetRpm += Math.abs(this.engineInput) * 4000;
            }
        }

        // Smooth RPM
        this.rpm = THREE.MathUtils.lerp(this.rpm, targetRpm, 0.15);
        if (this.rpm > this.maxRpm) this.rpm = this.maxRpm;

        // 4. Calculate Torque & Force
        // Curve: 8000 - 7100*e^(-2.4t) implies torque drops as RPM rises
        const normRpm =
            (this.rpm - this.idleRpm) / (this.maxRpm - this.idleRpm);
        let torqueFactor = 1.0 - 0.4 * normRpm; // Linear drop from 1.0 to 0.6 (more power at high RPM)
        if (torqueFactor < 0.1) torqueFactor = 0.1;

        let force = 0;
        if (this.currentGear !== 0 && !isShifting) {
            // Force = Input * Base * Torque * Ratio * Final
            // Note: engineInput is -1 to 1.
            // If Gear > 0 (Forward): Input > 0 -> Positive Force. Input < 0 -> Negative Force (Braking/Reverse torque).
            // If Gear < 0 (Reverse): Input < 0 -> Negative Force (Accelerating backwards). Input > 0 -> Positive Force (Braking).

            // at 0 m/s -> minLaunchScale, reach 100% at launchFullSpeedMs
            const launchScale = THREE.MathUtils.clamp(
                speedMs / this.launchFullSpeedMs,
                this.minLaunchScale,
                1.0
            );

            // absolute ratio for calculation, direction comes from input
            force =
                launchScale *
                this.engineInput *
                this.engineBaseForce *
                torqueFactor *
                Math.abs(ratio) *
                this.finalDrive;
        }

        const brakeForce = this.brakeInput ? this.maxBrakeForce : 0;
        const steerAngle = this.maxSteer * this.steerInput;
        const numWheels = this.vehicle.numWheels();

        for (let i = 0; i < numWheels; i++) {
            // rear-wheel drive
            if (i >= 2) this.vehicle.setWheelEngineForce(i, force);
            else this.vehicle.setWheelEngineForce(i, 0);

            // front steering
            if (i < 2) this.vehicle.setWheelSteering(i, steerAngle);
            else this.vehicle.setWheelSteering(i, 0);

            this.vehicle.setWheelBrake(i, brakeForce);
        }

        // apply forces to chassis
        this.vehicle.updateVehicle(dt);

        if (wantsAutoSleep) {
            const zero = new RAPIER.Vector3(0, 0, 0);
            this.chassisBody.setLinvel(zero, true);
            this.chassisBody.setAngvel(zero, true);
            this.chassisBody.sleep();
        }

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
        const lateralSpeed = vLocal.x; // +X is right
        const wheelDebug = [];
        const wheelLabels = ["FL", "FR", "RL", "RR"];

        for (let i = 0; i < numWheels; i++) {
            const hp = this.vehicle.wheelHardPoint(i);
            const len = this.vehicle.wheelSuspensionLength(i);
            const compression = Math.max(
                0,
                this.suspensionRestLength -
                    Math.min(this.suspensionRestLength, len)
            );
            const inContact = len < this.suspensionRestLength - 0.002;
            wheelDebug[i] = {
                label: wheelLabels[i] || `W${i}`,
                length: len,
                compression,
                inContact,
            };

            const wx = hp.x;
            const wy = hp.y - len;
            const wz = hp.z;

            const worldPos = new THREE.Vector3(wx, wy, wz);
            const localPos = worldPos
                .clone()
                .sub(chassisPos)
                .applyQuaternion(invChassisQuat);

            const slot = this.wheelSlots[i];
            const steerPivot = this.wheelSteerPivots[i];
            const rollPivot = this.wheelRollPivots[i];

            if (i < 2) {
                localPos.z += this.frontWheelForwardOffset;
            }

            // Remove left wheel inward offset for symmetry
            // if (i === 0 || i === 2) {
            //     localPos.x -= this.leftWheelInwardOffset;
            // }

            slot.position.copy(localPos);

            const steering = this.vehicle.wheelSteering(i);
            const rotation = -this.vehicle.wheelRotation(i);

            const qSteer = new THREE.Quaternion().setFromAxisAngle(
                new THREE.Vector3(0, 1, 0),
                steering
            );
            const qRoll = new THREE.Quaternion().setFromAxisAngle(
                new THREE.Vector3(-1, 0, 0),
                rotation
            );

            steerPivot.quaternion.copy(qSteer);
            rollPivot.quaternion.copy(qRoll);
        }

        if (this.debugPanel) {
            const dragForce = this.dragCoeff * speedMs * speedMs;
            const downforce = this.downforceCoeff * speedMs * speedMs;

            this.debugPanel.update({
                speedMph,
                forwardSpeed,
                lateralSpeed,
                engineInput: this.engineInput,
                brakeInput: this.brakeInput,
                steerInput: this.steerInput,
                gear: this.currentGear,
                rpm: this.rpm,
                engineForce: force,
                downforce,
                drag: dragForce,
                wheels: wheelDebug,
            });
        }
    }
}
