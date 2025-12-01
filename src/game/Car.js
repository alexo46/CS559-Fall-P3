import * as THREE from "three";
import { RAPIER } from "../physics/WorldPhysics.js";

const CAR_DIMENSIONS = {
    width: 1,
    height: 0.55,
    length: 2.55w,
};

const WHEEL_RADIUS = 0.38; // match example radius
const SUSPENSION_REST_LENGTH = 0.3;
const SUSPENSION_STIFFNESS = 30;
const SUSPENSION_DAMPING = {
    compression: 4.4,
    relaxation: 2.3,
};

// Map example's vehicleFront/back/width/height to our X/Z/Y
// vehicleFront: -1.35, vehicleBack: 1.3, vehicleWidth: 1.7, vehicleHeight: -0.3
const WHEEL_OFFSETS = [
    // Front left / right (steer, drive)
    { x: -1.35, y: -0.3, z: 0.85, steer: true, drive: true },
    { x: -1.35, y: -0.3, z: -0.85, steer: true, drive: true },
    // Rear left / right (drive only)
    { x: 1.3, y: -0.3, z: 0.85, steer: false, drive: true },
    { x: 1.3, y: -0.3, z: -0.85, steer: false, drive: true },
];

const DEFAULT_WHEEL_SETTINGS = {
    frictionSlip: 1.4,
    sideFrictionStiffness: 1.0,
    maxSuspensionForce: 100000,
    maxSuspensionTravel: 0.3,
};

export class Car {
    constructor(physics, scene) {
        this.physics = physics;
        this.scene = scene;

        this.group = new THREE.Group();
        this.startPosition = new THREE.Vector3(0, 1.5, 0);
        this.maxEngineForce = 3000;
        this.maxBrakeForce = 40;
        this.idleBrakeForce = 10;
        this.maxSteerAngle = THREE.MathUtils.degToRad(0.6 * 180) / 180; // ~0.6 rad

        this.tempForward = new THREE.Vector3();
        this.tempWheelPos = new THREE.Vector3();
        this.tempWheelDir = new THREE.Vector3();

        this.driveWheels = [];
        this.steerWheels = [];
        this.allWheelIndices = [];
        this.wheelMeshes = [];

        this.currentEngineForce = 0;
        this.currentSteerAngle = 0;

        this.createBody();
        this.setupVehicleController();
        this.createVisuals();

        this.scene.add(this.group);
    }

    createBody() {
        const { width, height, length } = CAR_DIMENSIONS;

        const bodyDesc = RAPIER.RigidBodyDesc.dynamic()
            .setTranslation(
                this.startPosition.x,
                this.startPosition.y,
                this.startPosition.z
            )
            .setLinearDamping(0.25)
            .setAngularDamping(5.0);

        this.chassisBody = this.physics.world.createRigidBody(bodyDesc);

        const colliderDesc = RAPIER.ColliderDesc.cuboid(2.35, 0.55, 1.0)
            .setTranslation(-0.2, -0.25, 0)
            .setDensity(1.5)
            .setFriction(1.0)
            .setRestitution(0.02);

        this.physics.world.createCollider(colliderDesc, this.chassisBody);
    }

    setupVehicleController() {
        const world = this.physics.world;
        this.vehicle = new RAPIER.DynamicRayCastVehicleController(
            this.chassisBody,
            world.broadPhase,
            world.narrowPhase,
            world.bodies,
            world.colliders
        );

        this.vehicle.indexUpAxis = 1;

        const suspensionDir = { x: 0, y: -1, z: 0 };
        this.suspensionDirVec = new THREE.Vector3(0, -1, 0);
        const axleAxis = { x: 1, y: 0, z: 0 };

        WHEEL_OFFSETS.forEach((def, idx) => {
            this.vehicle.addWheel(
                { x: def.x, y: def.y, z: def.z },
                suspensionDir,
                axleAxis,
                SUSPENSION_REST_LENGTH,
                WHEEL_RADIUS
            );

            this.vehicle.setWheelSuspensionStiffness(idx, SUSPENSION_STIFFNESS);
            this.vehicle.setWheelSuspensionCompression(
                idx,
                SUSPENSION_DAMPING.compression
            );
            this.vehicle.setWheelSuspensionRelaxation(
                idx,
                SUSPENSION_DAMPING.relaxation
            );
            this.vehicle.setWheelMaxSuspensionForce(
                idx,
                DEFAULT_WHEEL_SETTINGS.maxSuspensionForce
            );
            this.vehicle.setWheelMaxSuspensionTravel(
                idx,
                DEFAULT_WHEEL_SETTINGS.maxSuspensionTravel
            );
            this.vehicle.setWheelFrictionSlip(
                idx,
                DEFAULT_WHEEL_SETTINGS.frictionSlip
            );
            this.vehicle.setWheelSideFrictionStiffness(
                idx,
                DEFAULT_WHEEL_SETTINGS.sideFrictionStiffness
            );

            if (def.drive) this.driveWheels.push(idx);
            if (def.steer) this.steerWheels.push(idx);
            this.allWheelIndices.push(idx);
        });
    }

    createVisuals() {
        const bodyGeo = new THREE.BoxGeometry(
            CAR_DIMENSIONS.width,
            CAR_DIMENSIONS.height,
            CAR_DIMENSIONS.length
        );
        const bodyMat = new THREE.MeshStandardMaterial({
            color: 0x30343f,
            metalness: 0.1,
            roughness: 0.75,
        });

        const chassis = new THREE.Mesh(bodyGeo, bodyMat);
        chassis.castShadow = true;
        chassis.receiveShadow = true;
        this.group.add(chassis);
        this.mesh = chassis;

        const cabinGeo = new THREE.BoxGeometry(
            CAR_DIMENSIONS.width * 0.7,
            CAR_DIMENSIONS.height * 0.6,
            CAR_DIMENSIONS.length * 0.55
        );
        const cabinMat = new THREE.MeshStandardMaterial({
            color: 0x4c525e,
            metalness: 0.2,
            roughness: 0.65,
        });
        const cabin = new THREE.Mesh(cabinGeo, cabinMat);
        cabin.position.set(0, CAR_DIMENSIONS.height * 0.35, -0.4);
        cabin.castShadow = true;
        cabin.receiveShadow = true;
        this.group.add(cabin);

        const wheelGeometry = new THREE.CylinderGeometry(
            WHEEL_RADIUS,
            WHEEL_RADIUS,
            0.4,
            20
        );
        wheelGeometry.rotateZ(Math.PI / 2);
        const wheelMaterial = new THREE.MeshStandardMaterial({
            color: 0x111111,
            roughness: 0.9,
        });

        WHEEL_OFFSETS.forEach((_, idx) => {
            const wheelMesh = new THREE.Mesh(wheelGeometry, wheelMaterial);
            wheelMesh.castShadow = true;
            wheelMesh.receiveShadow = true;
            this.scene.add(wheelMesh);
            this.wheelMeshes[idx] = wheelMesh;
        });
    }

    applyControls({ drive = 0, steer = 0, brake = false } = {}) {
        if (!this.vehicle) return;

        const driveInput = Math.max(-1, Math.min(1, drive));
        const steerInput = Math.max(-1, Math.min(1, steer));

        const engineForce = driveInput * this.maxEngineForce;
        const steeringAngle = steerInput * this.maxSteerAngle;

        this.driveWheels.forEach((index) => {
            this.vehicle.setWheelEngineForce(index, engineForce);
        });

        this.steerWheels.forEach((index) => {
            this.vehicle.setWheelSteering(index, steeringAngle);
        });

        let brakeForce = 0;
        if (brake) {
            brakeForce = this.maxBrakeForce;
        } else if (Math.abs(engineForce) < 1e-3) {
            brakeForce = this.idleBrakeForce;
        }

        this.allWheelIndices.forEach((index) => {
            this.vehicle.setWheelBrake(index, brakeForce);
        });

        this.currentEngineForce = engineForce;
        this.currentSteerAngle = steeringAngle;
    }

    syncGraphicsFromPhysics() {
        if (!this.chassisBody) return;

        const translation = this.chassisBody.translation();
        const rotation = this.chassisBody.rotation();

        this.group.position.set(translation.x, translation.y, translation.z);
        this.group.quaternion.set(
            rotation.x,
            rotation.y,
            rotation.z,
            rotation.w
        );

        if (this.vehicle && this.wheelMeshes.length) {
            const chassisQuat = this.group.quaternion;

            this.wheelMeshes.forEach((wheelMesh, idx) => {
                if (!wheelMesh) return;

                const inContact = this.vehicle.wheelIsInContact(idx);
                let center = this.tempWheelPos;

                if (inContact) {
                    const cp = this.vehicle.wheelContactPoint(idx);
                    const cn = this.vehicle.wheelContactNormal(idx);

                    const normal = new THREE.Vector3(
                        cn.x,
                        cn.y,
                        cn.z
                    ).normalize();

                    center.set(cp.x, cp.y, cp.z);
                    center.addScaledVector(normal, WHEEL_RADIUS);
                } else {
                    const hardPoint = this.vehicle.wheelHardPoint(idx);
                    const suspensionLength =
                        this.vehicle.wheelSuspensionLength(idx) ??
                        SUSPENSION_REST_LENGTH;

                    const dirWorld = this.tempWheelDir
                        .copy(this.suspensionDirVec)
                        .applyQuaternion(this.group.quaternion)
                        .normalize();

                    this.tempWheelPos.set(
                        hardPoint.x,
                        hardPoint.y,
                        hardPoint.z
                    );
                    this.tempWheelPos.addScaledVector(
                        dirWorld,
                        suspensionLength
                    );
                }

                wheelMesh.position.copy(center);
                wheelMesh.quaternion.copy(chassisQuat);

                const steerAngle = this.vehicle.wheelSteering(idx) ?? 0;
                if (Math.abs(steerAngle) > 1e-4) {
                    wheelMesh.rotateY(steerAngle);
                }

                const roll = this.vehicle.wheelRotation(idx) ?? 0;
                wheelMesh.rotateX(roll);
            });
        }
    }

    update(dt) {
        if (this.vehicle) {
            this.vehicle.updateVehicle(dt);
        }

        this.syncGraphicsFromPhysics();
    }
}
