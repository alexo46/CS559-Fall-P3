import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { RAPIER } from "../../../physics/WorldPhysics.js";

/**
 * @param {Object} options
 * @param {string} [options.assetBaseUrl]         Folder where GLBs live.
 * @param {THREE.LoadingManager} [options.loadingManager]
 * @param {Array<Object>} [options.extraObjects]  Extra models: [{ name, file }]
 * @param {RAPIER.World} [options.world]          Rapier world to add static colliders to.
 * @param {(payload: {def, gltf, object, trackGroup, world, RAPIER})} [options.onObjectLoaded]
 */
export function createRaceTrack(options = {}) {
    const {
        assetBaseUrl = "/src/assets/models/racetrack/",
        loadingManager,
        extraObjects = [],
        world = null,
        onObjectLoaded,
    } = options;
    const trackGroup = new THREE.Group();
    trackGroup.name = "RaceTrack";

    const loader = new GLTFLoader(loadingManager);

    const defaultObjects = [
        { name: "road_inside", file: "road_inside.glb" },
        { name: "road_outside", file: "road_outside.glb" },
        { name: "road_barriers", file: "road_barrier.glb" },
        { name: "road_tunnel", file: "road_tunnel.glb" },
    ];

    const objectsToLoad = [...defaultObjects, ...extraObjects];

    trackGroup.userData.colliders = [];
    trackGroup.userData.objectsByName = {};

    const loadPromises = objectsToLoad.map((def) => {
        const url = assetBaseUrl + def.file;

        return new Promise((resolve, reject) => {
            loader.load(
                url,
                (gltf) => {
                    const obj = gltf.scene || gltf.scenes?.[0];
                    if (!obj) {
                        reject(new Error(`No scene in GLB: ${url}`));
                        return;
                    }

                    obj.name = def.name;
                    trackGroup.add(obj);

                    // --- Default: create static trimesh colliders for all meshes in road_* models ---
                    if (world) {
                        console.log(
                            "Adding static mesh colliders for",
                            def.name
                        );
                        addStaticMeshColliders(obj, world, trackGroup);
                    }

                    // Optional user hook
                    if (onObjectLoaded) {
                        onObjectLoaded({
                            def,
                            gltf,
                            object: obj,
                            trackGroup,
                            world,
                            RAPIER,
                        });
                    }

                    trackGroup.userData.objectsByName[def.name] = obj;
                    resolve(obj);
                },
                undefined,
                (err) => reject(err)
            );
        });
    });

    trackGroup.userData.loadPromise = Promise.all(loadPromises).catch((e) => {
        console.error("Error loading race track objects:", e);
    });

    return trackGroup;
}

/**
 * Create static trimesh colliders in Rapier for every mesh under root.
 * Assumes your meshes are not being scaled dynamically after load.
 */
function addStaticMeshColliders(root, world, trackGroup) {
    root.updateWorldMatrix(true, true);

    root.traverse((child) => {
        if (!child.isMesh || !child.geometry) return;

        const geom = child.geometry;
        const posAttr = geom.attributes.position;
        if (!posAttr) return;

        // Get world transform to bake scale
        const worldPos = new THREE.Vector3();
        const worldQuat = new THREE.Quaternion();
        const worldScale = new THREE.Vector3();
        child.matrixWorld.decompose(worldPos, worldQuat, worldScale);

        // Build vertex array with baked scale
        const vertices = new Float32Array(posAttr.count * 3);
        for (let i = 0; i < posAttr.count; i++) {
            vertices[i * 3 + 0] = posAttr.getX(i) * worldScale.x;
            vertices[i * 3 + 1] = posAttr.getY(i) * worldScale.y;
            vertices[i * 3 + 2] = posAttr.getZ(i) * worldScale.z;
        }

        // Build index array (or sequential if no index)
        let indices;
        if (geom.index) {
            const indexAttr = geom.index;
            indices = new Uint32Array(indexAttr.count);
            for (let i = 0; i < indexAttr.count; i++) {
                indices[i] = indexAttr.getX(i);
            }
        } else {
            indices = new Uint32Array(posAttr.count);
            for (let i = 0; i < posAttr.count; i++) {
                indices[i] = i;
            }
        }

        const colliderDesc = RAPIER.ColliderDesc.trimesh(vertices, indices);

        // Place collider at the mesh's world transform (translation/rotation only)
        colliderDesc.setTranslation(worldPos.x, worldPos.y, worldPos.z);
        colliderDesc.setRotation({
            x: worldQuat.x,
            y: worldQuat.y,
            z: worldQuat.z,
            w: worldQuat.w,
        });

        // (Ignoring non-uniform scale; ideally bake scale into vertices first if needed)

        const collider = world.createCollider(colliderDesc);
        trackGroup.userData.colliders.push(collider);
    });
}
