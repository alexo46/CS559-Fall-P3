/**
 * @ts-check
 */
import * as THREE from "three";
import { Sky as ThreeSky } from "three/addons/objects/Sky.js";

/**
 * Creates and manages a dynamic sky environment using Three.js's Sky shader.
 * Derived from three.js examples: https://threejs.org/examples/?q=sky#webgl_shaders_sky
 */
export class SkyEnvironment {
    /**
     * Creates and configures a skydome for the given Three.js scene and ties it to the provided renderer.
     *
     * The constructor:
     *  - Instantiates a ThreeSky object, scales it, and adds it to the provided scene.
     *  - Creates a THREE.Vector3 to store the sun position.
     *  - Merges provided options with sensible defaults for atmospheric scattering and sun placement.
     *  - Applies the resulting settings (via an internal _applySettings call).
     *
     * @param {THREE.Scene} scene - The Three.js scene that will receive the sky object.
     * @param {THREE.WebGLRenderer} renderer - The renderer used for exposure and any renderer-specific adjustments.
     * @param {THREE.DirectionalLight} sunLight - The directional light representing the sun in the scene.
     * @param {Object} [options={}] - Optional settings to customize the sky appearance.
     *
     * @constructor
     */
    constructor(scene, renderer, sunLight, options = {}) {
        this.scene = scene;
        this.renderer = renderer;
        this.sunLight = sunLight;

        this.sky = new ThreeSky();
        this.sky.scale.setScalar(450000);
        this.scene.add(this.sky);

        this.sun = new THREE.Vector3();

        const defaults = {
            turbidity: 8.4,
            rayleigh: 3.066,
            mieCoefficient: 0.004,
            mieDirectionalG: 0.963,
            elevation: 64.6,
            azimuth: 36.8,
            exposure: 0.3,
        };

        this.settings = { ...defaults, ...options };

        this._applySettings();
    }

    _applySettings() {
        const {
            turbidity,
            rayleigh,
            mieCoefficient,
            mieDirectionalG,
            elevation,
            azimuth,
            exposure,
        } = this.settings;

        const uniforms = this.sky.material.uniforms;
        uniforms.turbidity.value = turbidity;
        uniforms.rayleigh.value = rayleigh;
        uniforms.mieCoefficient.value = mieCoefficient;
        uniforms.mieDirectionalG.value = mieDirectionalG;

        const phi = THREE.MathUtils.degToRad(90 - elevation);
        const theta = THREE.MathUtils.degToRad(azimuth);

        this.sun.setFromSphericalCoords(1, phi, theta);
        uniforms.sunPosition.value.copy(this.sun);

        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = exposure;

        if (this.sunLight) {
            const dir = this.sun.clone().normalize();
            const dist = 50;
            this.sunLight.position.copy(dir).multiplyScalar(dist);
            this.sunLight.target.position.set(0, 0, 0);
            this.sunLight.target.updateMatrixWorld();
        }
    }
}
