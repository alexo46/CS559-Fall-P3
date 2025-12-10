import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/Addons.js";

function easeInOutQuad(x) {
    return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;
}

export class CameraController {
    constructor(camera, domElement) {
        this.camera = camera;
        this.controls = new OrbitControls(this.camera, domElement);
        this.easeTime = 0.5; // seconds
        this.lastManualInput = 0;

        // Initialize with null to force a sync on first frame
        this.currentDistance = null;
        this.currentPolar = null;
        this.currentAzimuthal = null;
    }

    // Helper to get shortest angle difference
    getAngleDiff(target, current) {
        let diff = target - current;
        // Normalize to -PI to +PI
        while (diff > Math.PI) diff -= 2 * Math.PI;
        while (diff < -Math.PI) diff += 2 * Math.PI;
        return diff;
    }

    // Helper to sync internal variables with where the camera actually is
    syncInternalState(carPos) {
        const offset = new THREE.Vector3().subVectors(
            this.camera.position,
            carPos
        );

        // Convert Cartesian (x,y,z) back to Spherical (radius, phi, theta)
        this.currentDistance = offset.length();

        // Handle vertical angle (Phi)
        this.currentPolar = Math.acos(
            THREE.MathUtils.clamp(offset.y / this.currentDistance, -1, 1)
        );

        // Handle horizontal angle (Theta / Azimuth)
        this.currentAzimuthal = Math.atan2(offset.x, offset.z);
    }

    update(dt, car) {
        if (!this.camera || !this.controls || !car) return;

        const now = performance.now();
        const carPos = car.getPosition();

        // 1. Handle User Interaction
        if (this.controls.userIsInteracting) {
            this.lastManualInput = now;
        }

        const timeSinceInteraction = now - this.lastManualInput;
        const isManualMode = timeSinceInteraction < this.easeTime * 1000;

        if (this.currentAzimuthal === null) {
            this.syncInternalState(carPos);
        }

        if (isManualMode) {
            this.controls.target.copy(carPos);
            this.controls.update();
            this.syncInternalState(carPos);
            return;
        }

        // 4. Calculate Auto-Follow Logic
        const targetAzimuthal = car.getDirectionofMotion();

        // FIX: Shortest path angle interpolation
        const azimuthalDiff = this.getAngleDiff(
            targetAzimuthal,
            this.currentAzimuthal
        );

        // Apply easing
        const lerpFactor = dt * 3.0; // Simple damping factor
        this.currentAzimuthal += azimuthalDiff * lerpFactor;

        // Smooth distance and polar back to defaults
        this.currentDistance += (50 - this.currentDistance) * lerpFactor;
        this.currentPolar += (Math.PI / 4 - this.currentPolar) * lerpFactor;

        // 5. Apply Position
        const offsetX =
            this.currentDistance *
            Math.sin(this.currentPolar) *
            Math.sin(this.currentAzimuthal);
        const offsetY = this.currentDistance * Math.cos(this.currentPolar);
        const offsetZ =
            this.currentDistance *
            Math.sin(this.currentPolar) *
            Math.cos(this.currentAzimuthal);

        this.camera.position.set(
            carPos.x - offsetX,
            carPos.y + offsetY,
            carPos.z - offsetZ
        );

        this.camera.lookAt(carPos);
        this.controls.target.copy(carPos);
    }
}
