import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { RAPIER } from "../../../physics/WorldPhysics.js";
import { Grandstand } from "./Grandstand.js";

const ASSET_BASE_PATH = "/src/assets/models/racetrack/";

const resolveAssetPath = (fileName, basePath = ASSET_BASE_PATH) => {
    const normalized = basePath.endsWith("/") ? basePath : `${basePath}/`;
    return `${normalized}${fileName}`;
};

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
        assetBaseUrl = ASSET_BASE_PATH,
        loadingManager,
        extraObjects = [],
        world = null,
        onObjectLoaded,
    } = options;
    const trackGroup = new THREE.Group();
    trackGroup.name = "RaceTrack";

    const loader = new GLTFLoader(loadingManager);

    const defaultObjects = [
        { name: "race_track", file: "demo_track/demo-racetrack.glb" },
        { name: "grandstand_spawns", file: "demo_track/grandstand-spawns.glb" },
        { name: "barriers", file: "demo_track/barrier.glb" },
        { name: "waypoints", file: "demo_track/waypoints.glb" },
    ];

    const objectsToLoad = [...defaultObjects, ...extraObjects];

    trackGroup.userData.colliders = [];
    trackGroup.userData.objectsByName = {};

    const loadPromises = objectsToLoad.map((def) => {
        const url = resolveAssetPath(def.file, assetBaseUrl);

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

                    if (def.name === "grandstand_spawns") {
                        addGrandstandsFromSpawns(obj, trackGroup);
                    }

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

function addGrandstandsFromSpawns(spawnRoot, trackGroup) {
    if (!spawnRoot) return;

    console.log("--- Processing Grandstand Spawns ---");
    // We don't need Euler anymore, we use Quaternions for full 3D rotation
    const tmpQuat = new THREE.Quaternion();

    spawnRoot.updateWorldMatrix(true, true);

    spawnRoot.traverse((child) => {
        if (child.name.includes("Spawn")) {
            // 1. Get Position and Full Rotation
            const worldPos = child.getWorldPosition(new THREE.Vector3());
            const worldQuat = child.getWorldQuaternion(tmpQuat);

            // 2. Read config (if any) or Default to Larger Size
            const config = child.userData?.grandstand ?? {};

            // Custom length multipliers based on spawn index
            let widthMult = 1;
            let idx = -1;

            // Handle "Spawn000", "Spawn001" etc.
            const match = child.name.match(/Spawn(\d+)/);
            if (match) {
                idx = parseInt(match[1], 10);
            } else if (child.name === "Spawn") {
                idx = 0;
            }

            if (idx === 0) widthMult = 7;
            else if ([2, 3, 5, 6, 7].includes(idx)) widthMult = 2;
            else if (idx === 4) widthMult = 3;

            // Rotate 90 degrees around Y to face the track
            const rotAdjustment = new THREE.Quaternion().setFromAxisAngle(
                new THREE.Vector3(0, 1, 0),
                Math.PI / 2
            );
            worldQuat.multiply(rotAdjustment);

            new Grandstand(trackGroup, {
                width: (config.width ?? 25) * widthMult,
                rows: config.rows ?? 10,

                hasRoof:
                    typeof config.hasRoof === "boolean" ? config.hasRoof : true,
                crowdDensity: config.crowdDensity ?? 0.5,

                position: worldPos, // Pass vector directly
                quaternion: worldQuat, // Pass full quaternion!
            });
        }
    });

    // Hide the ugly arrows now that we are done
    spawnRoot.visible = false;
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
