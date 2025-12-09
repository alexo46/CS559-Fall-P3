import * as THREE from "three";

import { Car } from "./Car.js";
import { AIDriver } from "./AIDriver.js";
import { SkyEnvironment } from "./environment/Sky.js";
import { WorldPhysics } from "../physics/WorldPhysics.js";
import { RapierDebugRenderer } from "../physics/RapierDebugRenderer.js";
import { createRaceTrack } from "../assets/models/racetrack/RaceTrack.js";
import { Speedometer } from "../ui/Speedometer.js";
import { RacingHUD } from "../ui/RacingHUD.js";

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

        this.minFov = this.camera.fov || 70;
        this.maxFov = this.minFov + 15;
        this.fovSpeedRange = { min: 0, max: 140 };

        // Race state
        this.raceStartTime = 0;
        this.currentLapStartTime = 0;
        this.lapTimes = [];
        this.bestLapTime = null;
        this.currentLap = 1;
        this.totalLaps = 3;
        this.finishLineZ = 0;
        this.lastPlayerZ = 0;
        this.lastAiZ = 0;

        this.trackLights = [];
    }

    async init(useDetailedModel = false) {
        this.setupLights();
        this.setupGround();
        await this.setupRaceTrack();
        this.setupCars(useDetailedModel);
    }

    setupLights() {
        const ambient = new THREE.AmbientLight(0xffffff, 0.35);
        this.scene.add(ambient);

        const hemi = new THREE.HemisphereLight(0xb1e1ff, 0x1d1d1d, 0.5);
        hemi.position.set(0, 40, 0);
        this.scene.add(hemi);

        this.sunLight = new THREE.DirectionalLight(0xffffff, 5.0);
        this.sunLight.castShadow = true;

        this.sunLight.position.set(80, 100, 40);

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

        const fillLight = new THREE.DirectionalLight(0xffe8d0, 1.2);
        fillLight.position.set(-60, 60, -50);
        this.scene.add(fillLight);

        this.setupTrackLights();
    }

    setupTrackLights() {
        const lampColor = 0xfff2c5;
        const positions = [
            new THREE.Vector3(40, 15, 20),
            new THREE.Vector3(-45, 15, -10),
            new THREE.Vector3(0, 15, -50),
            new THREE.Vector3(60, 15, -90),
            new THREE.Vector3(-70, 15, 50),
        ];

        positions.forEach((pos, idx) => {
            const spot = new THREE.SpotLight(
                lampColor,
                2.2,
                140,
                Math.PI / 4,
                0.35
            );
            spot.position.copy(pos);
            spot.castShadow = true;
            spot.shadow.mapSize.width = 1024;
            spot.shadow.mapSize.height = 1024;
            spot.shadow.camera.near = 5;
            spot.shadow.camera.far = 200;

            const target = new THREE.Object3D();
            target.position.set(pos.x, 0, pos.z);
            this.scene.add(target);

            spot.target = target;
            this.scene.add(spot);
            this.trackLights.push({ light: spot, target });
        });
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

        const geo = new THREE.PlaneGeometry(1000, 1000);
        const ground = new THREE.Mesh(geo, mat);
        ground.rotation.x = -Math.PI / 2;
        ground.position.y = -0.05;
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

    setupCars(useDetailedModel = false) {
        this.playerCar = new Car(this.physics, this.scene, useDetailedModel, {
            enableKeyboard: true,
        });
        this.playerCar.chassisBody.setTranslation({ x: -3, y: 5, z: 0 }, true);

        this.camera.position.set(0, 6, 14);
        this.camera.lookAt(this.playerCar.group.position);

        const waypointLoop = this.buildDefaultWaypoints();
        this.aiDriver = waypointLoop.length
            ? new AIDriver({
                  waypoints: waypointLoop,
                  waypointAdvanceDistance: 8,
                  targetSpeedMph: 55,
              })
            : null;

        this.aiCar = new Car(this.physics, this.scene, false, {
            enableKeyboard: false,
        });
        this.aiCar.chassisBody.setTranslation({ x: 8, y: 5, z: -5 }, true);
        this.aiCar.setControlProvider((dt) =>
            this.aiDriver ? this.aiDriver.update(this.aiCar, dt) : null
        );

        this.vehicles = [this.playerCar, this.aiCar];
        this.car = this.playerCar; // preserve existing references

        this.speedometer = new Speedometer();
        this.speedometer.visible = true;

        this.racingHUD = new RacingHUD();
        this.racingHUD.visible = true;
        this.racingHUD.updateLap(1, this.totalLaps);
        this.racingHUD.updatePosition(1, 2);

        this.raceStartTime = performance.now() / 1000;
        this.currentLapStartTime = this.raceStartTime;
    }

    buildDefaultWaypoints() {
        const points = [];
        const radiusX = 70;
        const radiusZ = 120;
        const segments = 24;
        const y = 0.5;

        for (let i = 0; i < segments; i++) {
            const angle = (i / segments) * Math.PI * 2;
            points.push(
                new THREE.Vector3(
                    Math.cos(angle) * radiusX,
                    y,
                    Math.sin(angle) * radiusZ
                )
            );
        }

        return points;
    }

    checkLapCrossing(car, lastZ) {
        const currentZ = car.group.position.z;
        const crossedLine =
            lastZ < this.finishLineZ && currentZ >= this.finishLineZ;
        return crossedLine;
    }

    update(dt, controls) {
        const speed = this.car.getCarMph();
        const rpm = this.car.getRPM();
        this.speedometer.updateSpeed(speed);
        this.speedometer.updateRPM(rpm);
        this.speedometer.draw();

        this.updateCameraFov(speed);

        this.physics.step(dt);
        this.playerCar?.update(dt);
        this.aiCar?.update(dt);

        // Update race telemetry
        const currentTime = performance.now() / 1000;
        const raceTime = currentTime - this.raceStartTime;
        const currentLapTime = currentTime - this.currentLapStartTime;

        this.racingHUD.updateRaceTime(raceTime);
        this.racingHUD.updateCurrentLapTime(currentLapTime);

        // Check for lap completion (player)
        if (this.checkLapCrossing(this.playerCar, this.lastPlayerZ)) {
            // Don't count the first crossing as a completed lap
            if (this.currentLap > 1 || currentLapTime > 5) {
                const lapTime = currentLapTime;
                this.lapTimes.push(lapTime);
                this.racingHUD.updateLastLapTime(lapTime);

                if (this.bestLapTime === null || lapTime < this.bestLapTime) {
                    this.bestLapTime = lapTime;
                    this.racingHUD.updateBestLapTime(lapTime);
                }

                this.currentLap++;
                this.racingHUD.updateLap(this.currentLap, this.totalLaps);
                this.currentLapStartTime = currentTime;

                if (this.currentLap > this.totalLaps) {
                    console.log("Race finished!");
                }
            }
        }

        // Simple position calculation
        const playerZ = this.playerCar.group.position.z;
        const aiZ = this.aiCar.group.position.z;
        const position = playerZ > aiZ ? 1 : 2;
        this.racingHUD.updatePosition(position, 2);

        this.lastPlayerZ = this.playerCar.group.position.z;
        this.lastAiZ = this.aiCar.group.position.z;

        // this.rapierDebugger.update();
    }

    updateCameraFov(speedMph) {
        const { min, max } = this.fovSpeedRange;
        const normalized = THREE.MathUtils.clamp(
            (speedMph - min) / (max - min || 1),
            0,
            1
        );
        const targetFov = THREE.MathUtils.lerp(
            this.minFov,
            this.maxFov,
            normalized
        );

        if (Math.abs(this.camera.fov - targetFov) > 0.05) {
            this.camera.fov = THREE.MathUtils.lerp(
                this.camera.fov,
                targetFov,
                0.1
            );
            this.camera.updateProjectionMatrix();
        }
    }
}
