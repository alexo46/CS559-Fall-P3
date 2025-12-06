import * as THREE from "three";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js";

const WHEEL_NAMES = [
    "wheela:3DWheel Front L",
    "wheela:3DWheel Front R",
    "wheela:3DWheel Rear L",
    "wheela:3DWheel Rear R",
];

function createSimpleChassis(wheelRadius) {
    const halfExtents = { x: 1.0, y: 0.35, z: 2.0 };
    const chassisGeo = new THREE.BoxGeometry(
        halfExtents.x * 2,
        halfExtents.y * 2,
        halfExtents.z * 2
    );
    const chassisMat = new THREE.MeshStandardMaterial({ color: 0x3366ff });
    const chassisMesh = new THREE.Mesh(chassisGeo, chassisMat);
    chassisMesh.castShadow = true;
    chassisMesh.receiveShadow = true;

    const wheelGeo = new THREE.CylinderGeometry(
        wheelRadius,
        wheelRadius,
        0.4,
        16
    );
    wheelGeo.rotateZ(Math.PI / 2);
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x111111 });

    const wheels = Array.from({ length: 4 }, () => {
        const mesh = new THREE.Mesh(wheelGeo, wheelMat);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        return mesh;
    });

    return { chassisMesh, wheelMeshes: wheels };
}

function loadDetailedChassis() {
    const loader = new FBXLoader();
    const url = new URL(
        "./nissan_detailed/DECIMATED_MODEL_S14.fbx",
        import.meta.url
    ).href;

    return new Promise((resolve, reject) => {
        loader.load(
            url,
            (fbx) => {
                const scale = 0.01;
                fbx.scale.set(scale, scale, scale);
                fbx.position.y = -0.5;

                fbx.traverse((child) => {
                    if (child.isMesh) {
                        child.castShadow = true;
                        child.receiveShadow = true;
                    }
                });

                const wheels = new Array(4).fill(null);
                WHEEL_NAMES.forEach((name, index) => {
                    const foundWheel = fbx.getObjectByName(name);
                    if (!foundWheel) {
                        console.warn(`Could not find wheel mesh: ${name}`);
                        return;
                    }

                    foundWheel.parent.remove(foundWheel);
                    foundWheel.position.set(0, 0, 0);
                    foundWheel.rotation.set(0, 0, 0);
                    foundWheel.scale.set(scale, scale, scale);
                    wheels[index] = foundWheel;
                });

                resolve({ chassisMesh: fbx, wheelMeshes: wheels });
            },
            undefined,
            (error) => reject(error)
        );
    });
}

/**
 * Loads the visual assets for the car (chassis + wheels).
 * @param {{ detailed?: boolean; wheelRadius?: number }} params
 * @returns {Promise<{ chassisMesh: THREE.Object3D; wheelMeshes: Array<THREE.Object3D|null> }>}
 */
export function loadCarModel({ detailed = false, wheelRadius = 0.5 } = {}) {
    if (!detailed) {
        return Promise.resolve(createSimpleChassis(wheelRadius));
    }

    return loadDetailedChassis();
}
