import * as THREE from "three";

export class ForceVisualizer {
    constructor(scene, { color = 0xffaa00, scale = 0.0005 } = {}) {
        this.scene = scene;
        this.color = color;
        this.scale = scale;
        this.helpers = new Map();
    }

    draw(name, origin, force) {
        const magnitude = force.length();
        if (magnitude === 0) {
            this.clear(name);
            return;
        }

        const length = magnitude * this.scale;
        const dir = force.clone().normalize();
        let helper = this.helpers.get(name);

        if (!helper) {
            helper = new THREE.ArrowHelper(
                dir,
                origin.clone(),
                length,
                this.color
            );
            this.scene.add(helper);
            this.helpers.set(name, helper);
        } else {
            helper.setDirection(dir);
            helper.setLength(length);
            helper.position.copy(origin);
        }
    }

    clear(name) {
        const helper = this.helpers.get(name);
        if (!helper) return;

        this.scene.remove(helper);
        helper.dispose?.();
        this.helpers.delete(name);
    }
}
