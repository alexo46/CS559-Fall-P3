import * as THREE from "three";

export class ForceVisualizer {
    constructor(
        scene,
        {
            color = 0xffaa00,
            scale = 0.05,
            minLength = 2,
            headLength = null,
            headWidth = null,
        } = {}
    ) {
        this.scene = scene;
        this.color = color;
        this.scale = scale;
        this.minLength = minLength;
        this.headLength = headLength;
        this.headWidth = headWidth;
        this.helpers = new Map();
    }

    draw(name, origin, force) {
        const magnitude = force.length();
        if (magnitude === 0) {
            this.clear(name);
            return;
        }

        const length = Math.max(magnitude * this.scale, this.minLength);
        const headLength = this.headLength ?? Math.max(length * 0.25, 0.75);
        const headWidth = this.headWidth ?? headLength * 0.5;
        const dir = force.clone().normalize();
        let helper = this.helpers.get(name);

        if (!helper) {
            helper = new THREE.ArrowHelper(
                dir,
                origin.clone(),
                length,
                this.color,
                headLength,
                headWidth
            );
            this.scene.add(helper);
            this.helpers.set(name, helper);
        } else {
            helper.setDirection(dir);
            helper.setLength(length, headLength, headWidth);
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
