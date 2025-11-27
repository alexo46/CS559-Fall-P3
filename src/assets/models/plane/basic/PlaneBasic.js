import * as THREE from "three";

export function createBasicPlane() {
    const planeGroup = new THREE.Group();

    const bodyGeo = new THREE.BoxGeometry(4, 0.6, 20);
    const wingGeo = new THREE.BoxGeometry(8, 0.4, 3);
    const tailGeo = new THREE.BoxGeometry(1.5, 0.6, 0.2);

    const mat = new THREE.MeshStandardMaterial({ color: 0xff5555 });

    const body = new THREE.Mesh(bodyGeo, mat);
    const leftWing = new THREE.Mesh(wingGeo, mat);
    const rightWing = new THREE.Mesh(wingGeo, mat);

    leftWing.position.set(-6, 0, 0);
    rightWing.position.set(6, 0, 0);
    const wing = new THREE.Group();
    wing.add(leftWing);
    wing.add(rightWing);

    const tail = createTailGeo(mat);
    tail.scale.set(0.5, 0.5, 0.5);
    tail.position.set(0, 1.75, -8);
    tail.rotation.y = Math.PI * (3 / 2);

    const horizontalTail = createHorizontalTailGeo(mat);
    horizontalTail.position.set(-4, 0.75, 0);
    tail.add(horizontalTail);

    body.castShadow = true;
    wing.castShadow = true;
    tail.castShadow = true;

    planeGroup.add(body, wing, tail);
    return planeGroup;
}

function createHorizontalTailGeo(material) {
    const width = 3.5;
    const height = 0.75;
    const depth = 11;
    const geometry = new THREE.BoxGeometry(width, height, depth);
    const box = new THREE.Mesh(geometry, material);
    box.castShadow = true;
    box.receiveShadow = true;
    return box;
}

function createTailGeo(material) {
    const width = 8;
    const height = 6;
    const depth = 1;

    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.lineTo(0, height);
    shape.lineTo(width, 0);
    shape.closePath();

    const extrudeSettings = { depth: depth, bevelEnabled: false };
    const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
    geometry.center();

    const wedge = new THREE.Mesh(geometry, material);
    wedge.castShadow = true;
    wedge.receiveShadow = true;

    return wedge;
}
