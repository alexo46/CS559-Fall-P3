import * as RAPIER from "@dimforge/rapier3d";

export class WorldPhysics {
    constructor() {
        this.fixedDt = 1 / 60;
        this.accumulator = 0;

        this.world = new RAPIER.World({ x: 0, y: -9.82, z: 0 });
        this.createGround();
    }

    createGround() {
        const groundBody = this.world.createRigidBody(
            RAPIER.RigidBodyDesc.fixed()
        );

        const groundCollider = RAPIER.ColliderDesc.cuboid(2500, 0.1, 2500)
            .setTranslation(0, -0.1, 0)
            .setFriction(0.9);

        this.world.createCollider(groundCollider, groundBody);
    }

    step(dt) {
        this.accumulator += dt;
        const maxSteps = 5;
        let steps = 0;

        while (this.accumulator >= this.fixedDt && steps < maxSteps) {
            this.world.timestep = this.fixedDt;
            this.world.step();
            this.accumulator -= this.fixedDt;
            steps += 1;
        }
    }
}

export { RAPIER };
