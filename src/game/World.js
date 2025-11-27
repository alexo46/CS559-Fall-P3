import * as THREE from "three";
import { Plane } from "./Plane.js";
import { SkyEnvironment } from "./environment/Sky.js";
import { WorldPhysics } from "../physics/WorldPhysics.js";

export class World {
    constructor(scene, camera, renderer) {
        this.scene = scene;
        this.camera = camera;
        this.renderer = renderer;

        this.physics = new WorldPhysics();

        this.setupLights();
        this.setupGround();
        this.setupPlane();

        this.sky = new SkyEnvironment(
            this.scene,
            this.renderer,
            this.sunLight,
            {}
        );
    }

    setupLights() {
        const ambient = new THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(ambient);

        this.sunLight = new THREE.DirectionalLight(0xffffff, 5.0);
        this.sunLight.castShadow = true;

        this.sunLight.shadow.mapSize.width = 2048;
        this.sunLight.shadow.mapSize.height = 2048;
        this.sunLight.shadow.camera.near = 1;
        this.sunLight.shadow.camera.far = 200;
        this.sunLight.shadow.camera.left = -100;
        this.sunLight.shadow.camera.right = 100;
        this.sunLight.shadow.camera.top = 100;
        this.sunLight.shadow.camera.bottom = -100;

        this.scene.add(this.sunLight);
        this.scene.add(this.sunLight.target);
    }

    setupGround() {
        const geo = new THREE.PlaneGeometry(5000, 5000);
        const mat = new THREE.MeshStandardMaterial({ color: 0x228b22 });
        const ground = new THREE.Mesh(geo, mat);
        ground.rotation.x = -Math.PI / 2;
        ground.position.y = 0;
        ground.receiveShadow = true;
        this.scene.add(ground);
    }

    setupPlane() {
        this.plane = new Plane(this.physics.world);
        this.scene.add(this.plane.group);
        this.plane.group.position.set(0, 5, 0);

        // Basic camera position to see the plane
        this.camera.position.set(0, 10, 20);
        this.camera.lookAt(this.plane.group.position);
    }

    update(dt) {
        // this.plane.group.rotation.y += 0.2 * dt;
        this.physics.step(dt);
    }
}
