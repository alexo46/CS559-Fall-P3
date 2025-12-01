import * as THREE from "three";
import { World } from "../game/World.js";
import { OrbitControls } from "three/examples/jsm/Addons.js";
import { InputManager } from "../input/InputManager.js";

export class Engine {
    constructor(container) {
        this.container = container;

        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x87ceeb); // sky

        this.camera = new THREE.PerspectiveCamera(
            70,
            container.clientWidth / container.clientHeight,
            0.1,
            5000
        );

        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(container.clientWidth, container.clientHeight);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        container.appendChild(this.renderer.domElement);

        this.controls = new OrbitControls(
            this.camera,
            this.renderer.domElement
        );
        this.controls.target.set(0, 0, 0);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.maxPolarAngle = Math.PI / 2;
        this.controls.minDistance = 5;
        this.controls.maxDistance = 200;

        this.input = new InputManager(window);
        this.world = new World(this.scene, this.camera, this.renderer);

        this.lastPlanePosition = null;
        this.cameraInitialized = false;
        this.cameraFollowOffset = new THREE.Vector3(0, 6, 18);
        this.tempVec = new THREE.Vector3();

        this.lastTime = 0;
        window.addEventListener("resize", () => this.onResize());
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

        const vehicleGroup = this.world?.car?.group ?? this.world?.plane?.group;
        if (vehicleGroup) {
            if (!this.cameraInitialized) {
                const offset = this.cameraFollowOffset
                    .clone()
                    .applyQuaternion(vehicleGroup.quaternion);
                this.camera.position.copy(vehicleGroup.position).add(offset);
                this.lastPlanePosition = vehicleGroup.position.clone();
                this.cameraInitialized = true;
            } else if (this.lastPlanePosition) {
                const delta = this.tempVec
                    .copy(vehicleGroup.position)
                    .sub(this.lastPlanePosition);
                this.camera.position.add(delta);
                this.lastPlanePosition.copy(vehicleGroup.position);
            }

            this.controls.target.copy(vehicleGroup.position);
        }

        this.controls.update();
        this.renderer.render(this.scene, this.camera);

        requestAnimationFrame((t) => this.loop(t));
    }
}
