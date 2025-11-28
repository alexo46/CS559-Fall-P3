// src/game/Plane.js
import * as THREE from "three";
import * as CANNON from "cannon-es";
import { createPlane } from "../assets/models/plane/index.js";

export class Plane {
    constructor(
        physicsWorld,
        { detail = "basic", forceVisualizer = null } = {}
    ) {
        this.physicsWorld = physicsWorld;
        this.forceVisualizer = forceVisualizer;

        this.group = new THREE.Group();

        const halfLength = 10; // half of plane length
        const halfHeight = 2;
        const halfWidth = 10;

        // visual debug box (Three) sized to the Cannon half-extents * 2
        const debugGeom = new THREE.BoxGeometry(
            halfLength * 2,
            halfHeight * 2,
            halfWidth * 2
        );
        const debugMat = new THREE.MeshBasicMaterial({
            color: 0xff0000,
            wireframe: true,
            depthTest: false,
        });
        const debugBox = new THREE.Mesh(debugGeom, debugMat);
        debugBox.name = "debugBox";
        this.group.add(debugBox);

        const shape = new CANNON.Box(
            new CANNON.Vec3(halfLength, halfHeight, halfWidth)
        );

        this.body = new CANNON.Body({
            mass: 500,
            shape,
            position: new CANNON.Vec3(0, 5, 0),
        });
        this.body.linearDamping = 0.02;
        this.body.angularDamping = 0.04;

        this.enginePosition = new CANNON.Vec3(0, 0, 10);
        this.engine = this.body.addShape(
            new CANNON.Box(new CANNON.Vec3(1, 0.5, 0.5)),
            this.enginePosition
        );

        physicsWorld.addBody(this.body);

        this.loaded = false;
        createPlane({ detail }).then((mesh) => {
            this.group.add(mesh);
            this.loaded = true;
        });

        this.wheels = [];
        this.maxEngineForce = 40000;
    }

    update(dt) {
        if (!this.body) return;

        this.group.position.copy(this.body.position);
        this.group.quaternion.copy(this.body.quaternion);

        for (const w of this.wheels) {
            w.mesh.position.copy(w.body.position);
            w.mesh.quaternion.copy(w.body.quaternion);
        }
    }

    applyThrottle(throttle = 0) {
        if (!this.body) return;

        const clamped = Math.min(Math.max(throttle, 0), 1);
        if (clamped === 0) {
            this.forceVisualizer?.clear("engine");
            return;
        }

        const force = clamped * this.maxEngineForce;
        const localForward = new CANNON.Vec3(0, 0, 1);
        const worldForward = new CANNON.Vec3();
        this.engine.vectorToWorldFrame(localForward, worldForward);
        worldForward.scale(force, worldForward);
        this.engine.applyForce(worldForward, this.enginePosition);

        if (this.forceVisualizer) {
            const origin = new THREE.Vector3(
                this.enginePosition.x,
                this.enginePosition.y,
                this.enginePosition.z
            );
            const forceVec = new THREE.Vector3(
                worldForward.x,
                worldForward.y,
                worldForward.z
            );
            this.forceVisualizer.draw("engine", origin, forceVec);
        }
    }
}
