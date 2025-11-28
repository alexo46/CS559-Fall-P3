import * as CANNON from "cannon-es";

export class WorldPhysics {
    constructor() {
        this.world = new CANNON.World({
            gravity: new CANNON.Vec3(0, -9.82, 0),
        });
        this.world.broadphase = new CANNON.NaiveBroadphase();
        this.world.allowSleep = true;

        this.createGround();
    }

    step(dt) {
        this.world.step(1 / 60, dt, 3);
    }

    createGround() {
        const groundShape = new CANNON.Plane();
        const groundBody = new CANNON.Body({ mass: 0, shape: groundShape });
        groundBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
        groundBody.position.set(0, 0, 0);
        this.world.addBody(groundBody);
    }
}
