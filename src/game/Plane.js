// src/game/Plane.js
import * as THREE from "three";
import * as CANNON from "cannon-es";
import { createPlane } from "../assets/models/plane/index.js";

export class Plane {
    constructor(physicsWorld, { detail = "basic" } = {}) {
        this.physicsWorld = physicsWorld;

        this.group = new THREE.Group();

        const halfLength = 5; // half of plane length
        const halfHeight = 0.5;
        const halfWidth = 2;

        const shape = new CANNON.Box(
            new CANNON.Vec3(halfLength, halfHeight, halfWidth)
        );

        this.body = new CANNON.Body({
            mass: 500,
            shape,
            position: new CANNON.Vec3(0, 5, 0),
        });

        physicsWorld.addBody(this.body);

        this.loaded = false;
        createPlane({ detail }).then((mesh) => {
            this.group.add(mesh);
            this.loaded = true;
        });

        this.wheels = [];
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

    applyThrottle(force = 2000) {
        const localForward = new CANNON.Vec3(0, 0, -1);
        const worldForward = new CANNON.Vec3();
        this.body.vectorToWorldFrame(localForward, worldForward);
        worldForward.scale(force, worldForward);
        this.body.applyForce(worldForward, this.body.position);
    }
}
