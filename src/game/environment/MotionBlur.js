import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { AfterimagePass } from "three/examples/jsm/postprocessing/AfterimagePass.js";

class MotionBlurPipeline {
    constructor(renderer, scene, camera, { damp = 0.995 } = {}) {
        this.renderer = renderer;
        this.scene = scene;
        this.camera = camera;

        this.composer = new EffectComposer(this.renderer);
        this.renderPass = new RenderPass(this.scene, this.camera);
        this.afterimagePass = new AfterimagePass(damp);

        this.composer.addPass(this.renderPass);
        this.composer.addPass(this.afterimagePass);
    }

    setSize(width, height) {
        this.composer.setSize(width, height);
    }

    render(delta) {
        this.composer.render(delta);
    }

    setDamp(value) {
        this.afterimagePass.uniforms["damp"].value = value;
    }
}

export function createMotionBlur(renderer, scene, camera, options) {
    return new MotionBlurPipeline(renderer, scene, camera, options);
}

export default MotionBlurPipeline;
