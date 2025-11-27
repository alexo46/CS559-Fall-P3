import * as CANNON from "cannon-es";

export class WorldPhysics {
    constructor() {
        this.world = new CANNON.World({
            gravity: new CANNON.Vec3(0, -9.82, 0),
        });
        this.world.broadphase = new CANNON.NaiveBroadphase();
    }

    step(dt) {
        this.world.step(1 / 60, dt, 3);
    }
}
