import * as THREE from "three";
import { World } from "../game/World.js";
// import MotionBlur from "../game/environment/MotionBlur.js";
import { InputManager } from "../input/InputManager.js";
import { CameraController } from "./CameraController.js";

export class Engine {
    constructor(container) {
        this.container = container;

        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x87ceeb); // sky

        this.camera = new THREE.PerspectiveCamera(
            50,
            container.clientWidth / container.clientHeight,
            0.1,
            5000
        );

        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(container.clientWidth, container.clientHeight);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        container.appendChild(this.renderer.domElement);

        this.cameraController = new CameraController(
            this.camera,
            this.renderer.domElement
        );

        this.input = new InputManager(window);

        this.motionBlur = null;

        this.lastTime = 0;
        window.addEventListener("resize", () => this.onResize());
    }

    async init(useDetailedModel = false, difficulty = "medium", totalLaps = 3) {
        this.world = new World(this.scene, this.camera, this.renderer);
        await this.world.init(useDetailedModel, difficulty, totalLaps); // waits for racetrack, then car

        // this.motionBlur = new MotionBlur(
        //     this.renderer,
        //     this.scene,
        //     this.camera,
        //     { damp: 0.88 }
        // );
    }

    onResize() {
        const w = this.container.clientWidth;
        const h = this.container.clientHeight;
        this.camera.aspect = w / h;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(w, h);
    }

    start() {
        this.lastTime = performance.now();
        requestAnimationFrame((t) => this.loop(t));
    }

    loop(time) {
        const dt = (time - this.lastTime) / 1000;
        this.lastTime = time;

        const controls = this.input.update(dt);
        this.world.update(dt, controls);

        const car = this.world?.car;
        if (car && this.cameraController) {
            this.cameraController.update(dt, car);
        }
        if (this.motionBlur) {
            this.motionBlur.render(dt);
        } else {
            this.renderer.render(this.scene, this.camera);
        }

        requestAnimationFrame((t) => this.loop(t));
    }
}
