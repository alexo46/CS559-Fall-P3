import * as THREE from "three";

export class Grandstand {
    constructor(scene, config) {
        this.scene = scene;
        this.width = config.width || 20;
        this.rows = config.rows || 5;
        this.hasRoof = config.hasRoof || false;
        this.crowdDensity = config.crowdDensity || 0.6;

        this.stepHeight = 0.6;
        this.stepDepth = 1.2;

        // --- 1. THE WRAPPER (Holds the World Transform) ---
        this.wrapper = new THREE.Group();

        // Apply Position
        if (config.position) {
            this.wrapper.position.copy(config.position);
        }

        // Apply Scale
        const s = config.scale || 2.5;
        this.wrapper.scale.set(s, s, s);

        // Apply Full Rotation (Quaternion)
        if (config.quaternion) {
            this.wrapper.quaternion.copy(config.quaternion);
        } else if (config.rotationY) {
            this.wrapper.rotation.y = config.rotationY;
        }

        // --- 2. THE MESH GROUP (Holds the Geometry) ---
        this.meshGroup = new THREE.Group();

        // --- 3. THE MAGIC FIX ---
        // Blender exported Y-Forward, Z-Up.
        // Three.js builds Y-Up, -Z-Forward.
        // Rotating X by +90 degrees aligns internal Y (Up) to External Z (Up)
        // and internal -Z (Front) to External Y (Forward/Track).
        // this.meshGroup.rotation.x = -Math.PI / 2;

        // Add mesh group to wrapper
        this.wrapper.add(this.meshGroup);

        this.materials = {
            concrete: new THREE.MeshStandardMaterial({
                color: 0x777777,
                roughness: 0.9,
            }),
            roof: new THREE.MeshStandardMaterial({
                color: 0xdddddd,
                side: THREE.DoubleSide,
            }),
            pillar: new THREE.MeshStandardMaterial({
                color: 0x444444,
                metalness: 0.6,
            }),
        };

        this.crowdTexture = this._generateCrowdTexture();

        this._buildStructure();
        if (this.hasRoof) this._buildRoof();
        this._populateCrowd();

        // Add the wrapper to the scene, not the meshGroup
        this.scene.add(this.wrapper);
    }

    // ... (Keep _generateCrowdTexture, _buildStructure, _buildRoof, _populateCrowd EXACTLY the same) ...
    // Just copy/paste your existing methods below here.

    _generateCrowdTexture() {
        // ... paste your existing code ...
        const canvas = document.createElement("canvas");
        canvas.width = 64;
        canvas.height = 128;
        const ctx = canvas.getContext("2d");
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(32, 20, 18, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(4, 40, 56, 88);
        const texture = new THREE.CanvasTexture(canvas);
        texture.colorSpace = THREE.SRGBColorSpace;
        return texture;
    }

    _buildStructure() {
        for (let i = 0; i < this.rows; i++) {
            const geo = new THREE.BoxGeometry(
                this.width,
                this.stepHeight,
                this.stepDepth
            );
            const step = new THREE.Mesh(geo, this.materials.concrete);
            step.position.y = i * this.stepHeight + this.stepHeight / 2;
            step.position.z = -i * this.stepDepth;
            step.receiveShadow = true;
            step.castShadow = true;
            this.meshGroup.add(step);
        }

        const totalHeight = this.rows * this.stepHeight;
        const wallGeo = new THREE.BoxGeometry(this.width, totalHeight, 0.5);
        const wall = new THREE.Mesh(wallGeo, this.materials.concrete);
        wall.position.z = -(this.rows * this.stepDepth) + this.stepDepth / 2;
        wall.position.y = totalHeight / 2;
        this.meshGroup.add(wall);
    }

    _buildRoof() {
        const totalDepth = this.rows * this.stepDepth;
        const totalHeight = this.rows * this.stepHeight;

        const roofGeo = new THREE.BoxGeometry(this.width, 0.2, totalDepth + 2);
        const roof = new THREE.Mesh(roofGeo, this.materials.roof);
        roof.position.y = totalHeight + 3.5;
        roof.position.z = -(totalDepth / 2 - 1);
        roof.rotation.x = 0.1;
        roof.castShadow = true;
        this.meshGroup.add(roof);

        const pillarGeo = new THREE.CylinderGeometry(0.3, 0.3, totalHeight + 4);
        const leftPillar = new THREE.Mesh(pillarGeo, this.materials.pillar);
        const rightPillar = new THREE.Mesh(pillarGeo, this.materials.pillar);
        const zPos = -totalDepth + 1;
        const yPos = (totalHeight + 4) / 2;

        leftPillar.position.set(-this.width / 2 + 1, yPos, zPos);
        rightPillar.position.set(this.width / 2 - 1, yPos, zPos);
        this.meshGroup.add(leftPillar);
        this.meshGroup.add(rightPillar);
    }

    _populateCrowd() {
        const seatsPerRow = Math.floor(this.width / 1.0);

        for (let r = 0; r < this.rows; r++) {
            for (let s = 0; s < seatsPerRow; s++) {
                if (Math.random() > this.crowdDensity) continue;

                const color = new THREE.Color().setHSL(Math.random(), 0.3, 0.2);

                const material = new THREE.SpriteMaterial({
                    map: this.crowdTexture,
                    color: color,
                });

                const sprite = new THREE.Sprite(material);

                const x = s * 1.0 - this.width / 2 + 0.5;
                const y = r * this.stepHeight + this.stepHeight + 0.5;
                const z = -r * this.stepDepth;

                sprite.position.set(
                    x + Math.random() * 0.2,
                    y,
                    z + Math.random() * 0.2
                );

                sprite.scale.set(0.8, 1.6, 1);
                this.meshGroup.add(sprite);
            }
        }
    }
}
