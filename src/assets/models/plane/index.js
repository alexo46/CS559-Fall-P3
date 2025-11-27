import { createBasicPlane } from "./basic/PlaneBasic.js";
import { loadGLTF } from "../../AssetLoader.js";

export async function createPlane({ detail = "basic" } = {}) {
    if (detail === "basic") {
        return createBasicPlane(); // returns THREE.Group/Mesh
    }

    // detailed version
    // const scene = await loadGLTF("/models/plane/plane.glb");
    // return scene;
    return createBasicPlane(); // placeholder
}
