import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { MotionBlurPass } from "../../postprocessing/MotionBlurPass.js"; // your local file
/**
 * Simple wrapper around `EffectComposer` and `MotionBlurPass`.
 *
 * Expects THREE, EffectComposer, RenderPass and MotionBlurPass to be available
 * in the current module scope.
 */
export default class MotionBlur {
    /**
     * @param {THREE.WebGLRenderer} renderer - The renderer used to draw the scene.
     * @param {THREE.Scene} scene - Scene to render.
     * @param {THREE.Camera} camera - Camera used for rendering and motion vectors.
     * @param {{ damp?: number }} [options] - Optional configuration.
     * @param {number} [options.damp=0.995] - Motion blur damping (higher = longer trails).
     */
    constructor(renderer, scene, camera, { damp = 0.995 } = {}) {
        this.renderScene = new RenderPass(scene, camera);
        this.motionPass = new MotionBlurPass(scene, camera, { damp });

        this.composer = new EffectComposer(renderer);
        this.composer.setSize(window.innerWidth, window.innerHeight);
        this.composer.addPass(this.renderScene);
        this.composer.addPass(this.motionPass);
        this.motionPass.renderToScreen = true;
    }

    /**
     * Render one frame of the motion-blur pipeline.
     */
    render() {
        this.composer.render();
    }
}
