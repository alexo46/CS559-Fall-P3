import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

const ASSET_BASE_PATH = "/src/assets/models/car/nissan_detailed/";

// Order: 0=FL, 1=FR, 2=RL, 3=RR to match Car.js wheel slots
const WHEEL_FILES = [
    "tire_fl.glb",
    "tire_fr.glb",
    "tire_bl.glb",
    "tire_br.glb",
];

const resolveAssetPath = (fileName) => `${ASSET_BASE_PATH}${fileName}`;

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

function loadWheelMeshes(scale = 1) {
    const loader = new GLTFLoader();

    return Promise.all(
        WHEEL_FILES.map((fileName, index) => {
            const url = resolveAssetPath(fileName);

            return new Promise((resolve) => {
                loader.load(
                    url,
                    (gltf) => {
                        const root = gltf.scene || gltf.scenes?.[0];
                        if (!root) {
                            console.warn(
                                `Wheel GLB missing scene: ${fileName}`
                            );
                            resolve(null);
                            return;
                        }

                        root.scale.set(scale, scale, scale);
                        root.position.set(0, 0, 0);
                        root.rotation.set(0, 0, 0);

                        root.traverse((child) => {
                            if (child.isMesh) {
                                child.castShadow = true;
                                child.receiveShadow = true;
                            }
                        });

                        const pivot = new THREE.Group();
                        pivot.add(root);

                        root.updateWorldMatrix(true, true);
                        const box = new THREE.Box3().setFromObject(root);
                        if (!box.isEmpty()) {
                            const center = box.getCenter(new THREE.Vector3());
                            root.position.sub(center);
                            root.updateWorldMatrix(true, true);
                        }

                        resolve(pivot);
                    },
                    undefined,
                    (error) => {
                        console.error(
                            `Failed to load wheel model ${fileName}`,
                            error
                        );
                        resolve(null);
                    }
                );
            });
        })
    );
}

function loadDetailedChassis() {
    const loader = new GLTFLoader();
    const url = resolveAssetPath("car.glb");

    return new Promise((resolve, reject) => {
        loader.load(
            url,
            (gltf) => {
                const scene = gltf.scene || gltf.scenes?.[0];
                if (!scene) {
                    reject(new Error("No scene found in car GLB"));
                    return;
                }

                const scale = 1;
                scene.scale.set(scale, scale, scale);
                scene.position.y = -0.5;

                scene.traverse((child) => {
                    if (child.isMesh) {
                        child.castShadow = true;
                        child.receiveShadow = true;
                    }
                });

                loadWheelMeshes(scale)
                    .then((wheelMeshes) => {
                        resolve({ chassisMesh: scene, wheelMeshes });
                    })
                    .catch(reject);
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
