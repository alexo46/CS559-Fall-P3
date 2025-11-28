import * as THREE from "three";
import { Plane } from "./Plane.js";
import { SkyEnvironment } from "./environment/Sky.js";
import { WorldPhysics } from "../physics/WorldPhysics.js";
import { ForceVisualizer } from "../input/ForceVisualizer.js";

export class World {
    constructor(scene, camera, renderer) {
        this.scene = scene;
        this.camera = camera;
        this.renderer = renderer;

        this.physics = new WorldPhysics();
        this.forceVisualizer = new ForceVisualizer(this.scene);

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
        const loader = new THREE.TextureLoader();

        const colorMap = loader.load(
            new URL(
                "../assets/textures/grass/Grass_001_COLOR.jpg",
                import.meta.url
            ).href
        );
        const normalMap = loader.load(
            new URL(
                "../assets/textures/grass/Grass_001_NORM.jpg",
                import.meta.url
            ).href
        );
        const roughnessMap = loader.load(
            new URL(
                "../assets/textures/grass/Grass_001_ROUGH.jpg",
                import.meta.url
            ).href
        );
        const aoMap = loader.load(
            new URL(
                "../assets/textures/grass/Grass_001_OCC.jpg",
                import.meta.url
            ).href
        );

        [colorMap, normalMap, roughnessMap, aoMap].forEach((t) => {
            if (!t) return;

            t.wrapS = t.wrapT = THREE.RepeatWrapping;
            t.repeat.set(40, 40);
        });

        const mat = new THREE.MeshStandardMaterial({
            map: colorMap,
            normalMap: normalMap,
            roughnessMap: roughnessMap,
            aoMap: aoMap,
        });

        const geo = new THREE.PlaneGeometry(500, 500);
        const ground = new THREE.Mesh(geo, mat);
        ground.rotation.x = -Math.PI / 2;
        ground.position.y = 0;
        ground.receiveShadow = true;
        this.scene.add(ground);
    }

    setupPlane() {
        this.plane = new Plane(this.physics.world, {
            detail: "basic",
            forceVisualizer: this.forceVisualizer,
        });
        this.scene.add(this.plane.group);
        this.plane.group.position.set(0, 5, 0);

        // Basic camera position to see the plane
        this.camera.position.set(0, 10, 20);
        this.camera.lookAt(this.plane.group.position);
    }

    update(dt, controls) {
        if (controls) {
            this.plane.applyThrottle(controls.throttle);
        }

        this.physics.step(dt);
        this.plane.update(dt);
    }
}
