import * as THREE from "three";
import { RAPIER } from "../../physics/WorldPhysics.js";

function makeTextSprite(text) {
    const canvas = document.createElement("canvas");
    const size = 128;
    canvas.width = size;
    canvas.height = size;

    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, size, size);
    ctx.fillStyle = "white";
    ctx.font = "64px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, size / 2, size / 2);

    const texture = new THREE.Texture(canvas);
    texture.needsUpdate = true;

    const material = new THREE.SpriteMaterial({
        map: texture,
        depthTest: false,
    });
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(10, 10, 1); // tweak size

    return sprite;
}

function getControlPointsForTrack(track = 0) {
    const basePoints = [
        // ---- Ground-level main loop ----
        new THREE.Vector3(-100, 0, -120), // 0
        new THREE.Vector3(0, 0, -200), // 1
        new THREE.Vector3(100, 0, -80), // 2
        new THREE.Vector3(140, 0, 0), // 3
        new THREE.Vector3(100, 0, 80), // 4
        new THREE.Vector3(40, 0, 40), // 5
        new THREE.Vector3(0, 0, 0), // 6
        new THREE.Vector3(-40, 0, 60), // 7
        new THREE.Vector3(-140, 0, 0), // 8

        // ramp up into spiral
        new THREE.Vector3(-120, 4, -20), // 9
        new THREE.Vector3(-80, 20, -40), // 10
        new THREE.Vector3(-40, 26, -20), // 11
        new THREE.Vector3(60, 30, -20), // 12 (spiral entry)
    ];

    const spiralCenter = new THREE.Vector3(0, 0, 0);
    const spiralTurns = 1.5;
    const spiralSteps = 20;
    const radiusStart = 80;
    const radiusEnd = 40;
    const heightStart = 30;
    const heightEnd = 0;
    1;
    const spiralPoints = [];

    for (let i = 0; i <= spiralSteps; i++) {
        const t = i / spiralSteps;
        const angle = t * spiralTurns * Math.PI * 2;
        const radius = THREE.MathUtils.lerp(radiusStart, radiusEnd, t);
        const y = THREE.MathUtils.lerp(heightStart, heightEnd, t);

        const x = spiralCenter.x + Math.cos(angle) * radius;
        const z = spiralCenter.z + Math.sin(angle) * radius;

        spiralPoints.push(new THREE.Vector3(x, y, z));
    }

    // exit section
    const exitPoints = [
        new THREE.Vector3(-40, 0, -60),
        new THREE.Vector3(-80, 0, -100),
        // new THREE.Vector3(-100, 0, -120),
    ];

    return [...basePoints, ...spiralPoints, ...exitPoints];
}

export function createRaceTrack(options = {}) {
    const trackGroup = new THREE.Group();
    const roadWidth = options.roadWidth ?? 12;
    const segments = options.segments ?? 400;

    const controlPoints = getControlPointsForTrack(0);

    // Debug points
    controlPoints.forEach((point, idx) => {
        const geo = new THREE.SphereGeometry(1);
        const mat = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
        const sphere = new THREE.Mesh(geo, mat);
        sphere.position.copy(point);
        sphere.userData.skipPhysics = true;
        trackGroup.add(sphere);

        const label = makeTextSprite(String(idx));
        label.position.copy(point);
        label.position.y += 4;
        label.userData.skipPhysics = true;
        trackGroup.add(label);
    });

    const curve = new THREE.CatmullRomCurve3(
        controlPoints,
        true,
        "centripetal"
    );

    // Visualize center line (optional)
    const centerPoints = curve.getPoints(segments);
    const centerGeo = new THREE.BufferGeometry().setFromPoints(centerPoints);
    const centerMat = new THREE.LineDashedMaterial({
        color: 0xffffff,
        dashSize: 4,
        gapSize: 2,
    });

    const centerLine = new THREE.Line(centerGeo, centerMat);
    centerLine.computeLineDistances();
    centerLine.position.y = 0.02;
    trackGroup.add(centerLine);

    // ----- Road strip -----
    const up = new THREE.Vector3(0, 1, 0);
    const halfWidth = roadWidth / 2;
    const positions = [];
    const indices = [];

    for (let i = 0; i < segments; i++) {
        const t = i / segments;

        const pos = curve.getPointAt(t);
        const tangent = curve.getTangentAt(t).normalize();

        // side = left vector (perpendicular to tangent)
        const side = new THREE.Vector3().crossVectors(up, tangent).normalize();

        const left = pos.clone().addScaledVector(side, +halfWidth);
        const right = pos.clone().addScaledVector(side, -halfWidth);

        // Slightly above to avoid z-fighting with anything below
        left.y += 0.01;
        right.y += 0.01;

        positions.push(left.x, left.y, left.z);
        positions.push(right.x, right.y, right.z);
    }

    for (let i = 0; i < segments; i++) {
        const iLeft = i * 2;
        const iRight = i * 2 + 1;
        const next = (i + 1) % segments;
        const nextLeft = next * 2;
        const nextRight = next * 2 + 1;

        indices.push(iLeft, iRight, nextLeft);
        indices.push(iRight, nextRight, nextLeft);
    }

    const roadGeo = new THREE.BufferGeometry();
    roadGeo.setAttribute(
        "position",
        new THREE.Float32BufferAttribute(positions, 3)
    );
    roadGeo.setIndex(indices);
    roadGeo.computeVertexNormals();

    const roadMat = new THREE.MeshStandardMaterial({
        color: 0x333333,
        metalness: 0.0,
        roughness: 0.9,
    });

    const roadMesh = new THREE.Mesh(roadGeo, roadMat);
    roadMesh.castShadow = true;
    roadMesh.receiveShadow = true;
    trackGroup.add(roadMesh);

    // ----- Curbs (unchanged from your version) -----
    const curbWidth = 1.2;
    const curbHeight = 0.2;
    const curbUpOffset = curbHeight / 2 + 0.02;

    const redMat = new THREE.MeshStandardMaterial({
        color: 0xff0000,
        metalness: 0.0,
        roughness: 0.5,
    });
    const whiteMat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        metalness: 0.0,
        roughness: 0.5,
    });

    function buildCurbs(sideSign) {
        const evenPositions = [];
        const oddPositions = [];
        const evenIndices = [];
        const oddIndices = [];
        let evenBase = 0;
        let oddBase = 0;

        const upVec = new THREE.Vector3(0, 1, 0);

        for (let i = 0; i < segments; i++) {
            let t0 = i / segments;
            let t1 = (i + 1) / segments;
            if (t1 > 1) t1 -= 1;

            const p0 = curve.getPointAt(t0);
            const p1 = curve.getPointAt(t1);
            const tangent0 = curve.getTangentAt(t0).normalize();

            const side = new THREE.Vector3()
                .crossVectors(upVec, tangent0)
                .normalize()
                .multiplyScalar(sideSign);

            const inner0 = p0.clone().addScaledVector(side, halfWidth);
            const inner1 = p1.clone().addScaledVector(side, halfWidth);
            const outer0 = inner0.clone().addScaledVector(side, curbWidth);
            const outer1 = inner1.clone().addScaledVector(side, curbWidth);

            inner0.y += curbUpOffset;
            inner1.y += curbUpOffset;
            outer0.y += curbUpOffset;
            outer1.y += curbUpOffset;

            const isEven = i % 2 === 0;
            const posArray = isEven ? evenPositions : oddPositions;
            const idxArray = isEven ? evenIndices : oddIndices;
            const baseIndex = isEven ? evenBase : oddBase;

            posArray.push(
                inner0.x,
                inner0.y,
                inner0.z,
                inner1.x,
                inner1.y,
                inner1.z,
                outer1.x,
                outer1.y,
                outer1.z,
                outer0.x,
                outer0.y,
                outer0.z
            );

            idxArray.push(
                baseIndex,
                baseIndex + 1,
                baseIndex + 2,
                baseIndex,
                baseIndex + 2,
                baseIndex + 3
            );

            if (isEven) {
                evenBase += 4;
            } else {
                oddBase += 4;
            }
        }

        const evenGeom = new THREE.BufferGeometry();
        evenGeom.setAttribute(
            "position",
            new THREE.Float32BufferAttribute(evenPositions, 3)
        );
        evenGeom.setIndex(evenIndices);
        evenGeom.computeVertexNormals();

        const oddGeom = new THREE.BufferGeometry();
        oddGeom.setAttribute(
            "position",
            new THREE.Float32BufferAttribute(oddPositions, 3)
        );
        oddGeom.setIndex(oddIndices);
        oddGeom.computeVertexNormals();

        const redMesh = new THREE.Mesh(evenGeom, redMat);
        const whiteMesh = new THREE.Mesh(oddGeom, whiteMat);

        // redMesh.castShadow = whiteMesh.castShadow = true;
        // redMesh.receiveShadow = whiteMesh.receiveShadow = true;

        trackGroup.add(redMesh, whiteMesh);
    }

    buildCurbs(+1);
    buildCurbs(-1);

    // ----- Barrier that follows height of the curve -----
    const barrierOffset = roadWidth / 2 + 0.5;
    const barrierRadius = 0.4;

    function makeBarrier(sideSign) {
        const barrierPositions = [];
        for (let i = 0; i <= segments; i++) {
            const t = i / segments;
            const p = curve.getPointAt(t);
            const tangent = curve.getTangentAt(t).normalize();
            const side = new THREE.Vector3()
                .crossVectors(up, tangent)
                .normalize()
                .multiplyScalar(sideSign * barrierOffset);

            const bp = p.clone().add(side);
            bp.y += 0.8; // slightly above road
            barrierPositions.push(bp);
        }

        const barrierCurve = new THREE.CatmullRomCurve3(
            barrierPositions,
            true,
            "centripetal"
        );
        const barrierGeo = new THREE.TubeGeometry(
            barrierCurve,
            segments,
            barrierRadius,
            8,
            true
        );
        const barrierMat = new THREE.MeshStandardMaterial({
            color: 0xff0000,
        });
        const barrierMesh = new THREE.Mesh(barrierGeo, barrierMat);
        // barrierMesh.castShadow = true;
        trackGroup.add(barrierMesh);
    }

    makeBarrier(+1);
    makeBarrier(-1);

    return trackGroup;
}

// New helper: create static triangle-mesh colliders for each mesh child.
// - trackGroup must be in its final world position/rotation/scale before calling.
export function addPhysicsToTrack(trackGroup, physicsWorld) {
    if (!physicsWorld || !RAPIER) {
        console.warn("addPhysicsToTrack: missing physicsWorld or RAPIER");
        return;
    }

    // Ensure world matrices are up-to-date
    trackGroup.updateWorldMatrix(true, true);

    const meshes = [];
    trackGroup.traverse((child) => {
        if (child.isMesh && !child.userData.skipPhysics) meshes.push(child);
    });
    meshes.forEach((mesh) => {
        const geom = mesh.geometry;
        if (!geom || !geom.attributes || !geom.attributes.position) return;

        // Update mesh world matrix to account for group transforms
        mesh.updateWorldMatrix(true, false);
        const matrixWorld = mesh.matrixWorld;

        const posAttr = geom.attributes.position;
        const indexAttr = geom.index;

        // Build transformed vertex array
        const v = new THREE.Vector3();
        const vertices = new Float32Array(posAttr.count * 3);
        for (let i = 0; i < posAttr.count; i++) {
            v.set(
                posAttr.getX(i),
                posAttr.getY(i),
                posAttr.getZ(i)
            ).applyMatrix4(matrixWorld);
            const base = i * 3;
            vertices[base] = v.x;
            vertices[base + 1] = v.y;
            vertices[base + 2] = v.z;
        }

        // Build index array (triangles)
        let indices;
        if (indexAttr) {
            // copy indices
            indices = new Uint32Array(indexAttr.count);
            for (let i = 0; i < indexAttr.count; i++) {
                indices[i] = indexAttr.array[i];
            }
        } else {
            // non-indexed -> triangles formed by sequential triplets
            const triCount = Math.floor(posAttr.count / 3);
            indices = new Uint32Array(triCount * 3);
            for (let i = 0; i < triCount * 3; i++) indices[i] = i;
        }

        try {
            const colliderDesc = RAPIER.ColliderDesc.trimesh(vertices, indices);
            const rbDesc = RAPIER.RigidBodyDesc.fixed();
            const rb = physicsWorld.createRigidBody(rbDesc);
            physicsWorld.createCollider(colliderDesc, rb);
        } catch (err) {
            console.error(
                "addPhysicsToTrack: failed to create collider for mesh",
                mesh,
                err
            );
        }
    });
}
