import * as THREE from "three";

import { Car } from "./Car.js";
import { SkyEnvironment } from "./environment/Sky.js";
import { WorldPhysics } from "../physics/WorldPhysics.js";
import { RapierDebugRenderer } from "../physics/RapierDebugRenderer.js";
import { createRaceTrack } from "../assets/models/racetrack/RaceTrack.js";
import { Speedometer } from "../ui/Speedometer.js";

export class World {
    constructor(scene, camera, renderer) {
        this.scene = scene;
        this.camera = camera;
        this.renderer = renderer;

        this.physics = new WorldPhysics();

        // this.rapierDebugger = new RapierDebugRenderer(
        //     this.scene,
        //     this.physics.world
        // );

        const axisHelper = new THREE.AxesHelper(60);
        this.scene.add(axisHelper);

        this.sky = new SkyEnvironment(
            this.scene,
            this.renderer,
            this.sunLight,
            {}
        );
    }

    async init() {
        this.setupLights();
        // this.setupGround();
        await this.setupRaceTrack();
        this.setupCar();
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

    async setupRaceTrack() {
        const raceTrack = createRaceTrack({
            world: this.physics.world,
            extraObjects: [
                // { name: "grandstand", file: "grandstand.glb" },
                // { name: "lamp_post", file: "lamp_post.glb" },
            ],
            onObjectLoaded: ({ def, object, trackGroup, RAPIER }) => {
                // e.g. add physics colliders here if you want
                // or tweak materials / shadow settings
                object.traverse((child) => {
                    if (child.isMesh) {
                        child.castShadow = true;
                        child.receiveShadow = true;

                        if (child.material && child.material.map) {
                            child.material.map.anisotropy =
                                this.renderer.capabilities.getMaxAnisotropy();
                        }
                    }
                });
            },
        });

        // somewhere after creation:
        this.scene.add(raceTrack);

        // Set scale BEFORE waiting for load, so colliders pick it up
        await raceTrack.userData.loadPromise;

        this.raceTrack = raceTrack;
    }

    setupCar() {
        this.car = new Car(this.physics, this.scene, true);
        this.camera.position.set(0, 6, 14);
        this.camera.lookAt(this.car.group.position);

        this.speedometer = new Speedometer();
        this.speedometer.visible = true;
    }

    update(dt, controls) {
        const speed = this.car.getCarMph();
        const rpm = this.car.getRPM();
        this.speedometer.updateSpeed(speed);
        this.speedometer.updateRPM(rpm);
        this.speedometer.draw();

        this.physics.step(dt);
        this.car.update(dt);
        // this.rapierDebugger.update();
    }
}
