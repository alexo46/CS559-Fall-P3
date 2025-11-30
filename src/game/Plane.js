import * as THREE from "three";
import { RAPIER } from "../physics/WorldPhysics.js";

const PLANE_DIMENSIONS = {
    width: 6,
    height: 1.2,
    length: 14,
};

const WHEEL_RADIUS = 0.9;
const SUSPENSION_REST_LENGTH = 1.5;
const SUSPENSION_STIFFNESS = 55;
const SUSPENSION_DAMPING = {
    compression: 3.5,
    relaxation: 4.5,
};

const WHEEL_OFFSETS = [
    { x: -2.0, y: -1.0, z: 3.5, steer: true, drive: true },
    { x: 2.0, y: -1.0, z: 3.5, steer: true, drive: true },
    { x: -2.0, y: -1.0, z: -3.2, steer: false, drive: false },
    { x: 2.0, y: -1.0, z: -3.2, steer: false, drive: false },
];

const DEFAULT_WHEEL_SETTINGS = {
    frictionSlip: 6.0,
    sideFrictionStiffness: 1.5,
    maxSuspensionForce: 25000,
    maxSuspensionTravel: 0.8,
};

export class Plane {
    constructor(physics, scene, { forceVisualizer = null } = {}) {
        this.physics = physics;
        this.scene = scene;
        this.forceVisualizer = forceVisualizer;

        this.group = new THREE.Group();
        this.maxEngineForce = 100;
        this.currentThrottle = 0;
        this.startPosition = new THREE.Vector3(0, 8, 0);

        // Reuse temp objects to avoid allocations every frame.
        this.tempQuaternion = new THREE.Quaternion();
        this.tempForward = new THREE.Vector3();
        this.tempForce = new THREE.Vector3();
        this.tempWheelPos = new THREE.Vector3();
        this.tempWheelDir = new THREE.Vector3();

        this.wheelMeshes = [];
        this.createBody();
        this.setupVehicleController();
        this.createVisuals();

        this.debug = { hard: [], contact: [], rays: [] };
        this.createRaycastDebug();

        this.scene.add(this.group);
    }

    createBody() {
        const { width, height, length } = PLANE_DIMENSIONS;

        // --- CHASSIS ---
        const bodyDesc = RAPIER.RigidBodyDesc.dynamic()
            .setTranslation(
                this.startPosition.x,
                this.startPosition.y,
                this.startPosition.z
            )
            .setLinearDamping(0.15)
            .setAngularDamping(0.3);

        this.body = this.physics.world.createRigidBody(bodyDesc);

        const colliderDesc = RAPIER.ColliderDesc.cuboid(
            width / 2,
            height / 2,
            length / 2
        )
            .setFriction(0.85)
            .setRestitution(0.05);

        this.physics.world.createCollider(colliderDesc, this.body);
    }

    setupVehicleController() {
        const world = this.physics.world;
        this.vehicle = new RAPIER.DynamicRayCastVehicleController(
            this.body,
            world.broadPhase,
            world.narrowPhase,
            world.bodies,
            world.colliders
        );

        this.vehicle.indexUpAxis = 1;

        const suspensionDir = { x: 0, y: -1, z: 0 };
        this.suspensionDirVec = new THREE.Vector3(0, -1, 0);
        this.axleAxisVec = new THREE.Vector3(1, 0, 0);
        const axleAxis = { x: 1, y: 0, z: 0 };

        this.driveWheels = [];
        this.steerWheels = [];

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
        });
    }

    createVisuals() {
        const { width, height, length } = PLANE_DIMENSIONS;
        const fuselageGeo = new THREE.BoxGeometry(width, height, length);
        const material = new THREE.MeshStandardMaterial({ color: 0xff5555 });
        const mesh = new THREE.Mesh(fuselageGeo, material);
        mesh.castShadow = true;
        mesh.receiveShadow = true;

        this.group.add(mesh);
        this.mesh = mesh;

        const wheelGeometry = new THREE.CylinderGeometry(
            WHEEL_RADIUS,
            WHEEL_RADIUS,
            0.4,
            18
        );
        wheelGeometry.rotateZ(Math.PI / 2);
        const wheelMaterial = new THREE.MeshStandardMaterial({
            color: 0x1d1d1d,
            metalness: 0.2,
            roughness: 0.7,
        });

        WHEEL_OFFSETS.forEach((_, idx) => {
            const wheelMesh = new THREE.Mesh(wheelGeometry, wheelMaterial);
            wheelMesh.castShadow = true;
            wheelMesh.receiveShadow = true;
            this.scene.add(wheelMesh);
            this.wheelMeshes[idx] = wheelMesh;
        });
    }

    applyThrottle(throttle = 0) {
        if (!this.body || !this.vehicle) return;

        this.currentThrottle = THREE.MathUtils.clamp(throttle, -1, 1);

        if (Math.abs(this.currentThrottle) < 1e-3) {
            this.forceVisualizer?.clear("engine");
        }

        const engineForce = this.currentThrottle * this.maxEngineForce;

        const rotation = this.body.rotation();
        this.tempQuaternion.set(rotation.x, rotation.y, rotation.z, rotation.w);
        this.tempForward
            .set(0, 0, -1)
            .applyQuaternion(this.tempQuaternion)
            .normalize();
        this.tempForce.copy(this.tempForward).multiplyScalar(engineForce);

        this.body.addForce(
            { x: this.tempForce.x, y: this.tempForce.y, z: this.tempForce.z },
            true
        );

        if (Math.abs(engineForce) < 1e-2) {
            this.driveWheels.forEach((index) => {
                this.vehicle.setWheelBrake(index, 10);
            });
        } else {
            this.driveWheels.forEach((index) => {
                this.vehicle.setWheelBrake(index, 0);
            });
        }

        if (this.forceVisualizer) {
            this.forceVisualizer.draw(
                "engine",
                this.group.position,
                this.tempForce
            );
        }
    }

    prePhysicsStep(dt) {
        if (!this.vehicle) return;
        this.vehicle.updateVehicle(dt);
    }

    syncGraphicsFromPhysics() {
        if (!this.body) return;

        const translation = this.body.translation();
        const rotation = this.body.rotation();

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
                        .copy(this.suspensionDirVec) // (0, -1, 0)
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

                const roll = this.vehicle.wheelRotation(idx);
                wheelMesh.rotateX(roll);
            });
        }

        if (this.vehicle && this.debug) {
            for (let i = 0; i < WHEEL_OFFSETS.length; i++) {
                const hp = this.vehicle.wheelHardPoint(i); // world-space start
                const inContact = this.vehicle.wheelIsInContact(i);
                const cp = inContact ? this.vehicle.wheelContactPoint(i) : null;

                // spheres
                const hpMesh = this.debug.hard[i];
                const cpMesh = this.debug.contact[i];

                hpMesh.position.set(hp.x, hp.y, hp.z);
                hpMesh.visible = true;

                if (cp) {
                    cpMesh.position.set(cp.x, cp.y, cp.z);
                    cpMesh.visible = true;
                } else {
                    cpMesh.visible = false;
                }

                // ray line: from hard point along suspension direction to max travel
                const dirWorld = this.tempWheelDir
                    .copy(this.suspensionDirVec) // (0, -1, 0) in chassis space
                    .applyQuaternion(this.group.quaternion) // to world
                    .normalize();

                const rest = this.vehicle.wheelSuspensionRestLength(i);
                const travel = this.vehicle.wheelMaxSuspensionTravel(i);
                const maxLen = rest + travel;

                const start = new THREE.Vector3(hp.x, hp.y, hp.z);
                const end = start.clone().addScaledVector(dirWorld, -maxLen);

                const line = this.debug.rays[i];
                line.geometry.setFromPoints([start, end]);
            }
        }
    }

    createRaycastDebug() {
        const hpMat = new THREE.MeshBasicMaterial({ color: 0x00ff00 }); // green: origin
        const cpMat = new THREE.MeshBasicMaterial({ color: 0xff0000 }); // red: contact
        const sphereGeo = new THREE.SphereGeometry(0.15, 8, 8);

        for (let i = 0; i < WHEEL_OFFSETS.length; i++) {
            const hpMesh = new THREE.Mesh(sphereGeo, hpMat);
            const cpMesh = new THREE.Mesh(sphereGeo, cpMat);
            this.scene.add(hpMesh, cpMesh);

            const lineGeo = new THREE.BufferGeometry().setFromPoints([
                new THREE.Vector3(),
                new THREE.Vector3(),
            ]);
            const lineMat = new THREE.LineBasicMaterial({ color: 0xffff00 });
            const line = new THREE.Line(lineGeo, lineMat);
            this.scene.add(line);

            this.debug.hard.push(hpMesh);
            this.debug.contact.push(cpMesh);
            this.debug.rays.push(line);
        }
    }

    update(dt) {
        if (this.vehicle) {
            this.vehicle.updateVehicle(dt);
        }

        this.syncGraphicsFromPhysics();

        if (Math.abs(this.currentThrottle) < 1e-3) {
            this.forceVisualizer?.clear("engine");
        }
    }
}
