import * as THREE from "three";

export class PIDController {
    constructor({ kp = 0, ki = 0, kd = 0, integralClamp = 1 } = {}) {
        this.kp = kp;
        this.ki = ki;
        this.kd = kd;
        this.integralClamp = Math.max(0, integralClamp);
        this.integral = 0;
        this.prevError = 0;
    }

    reset() {
        this.integral = 0;
        this.prevError = 0;
    }

    update(error, dt) {
        const deltaTime = dt > 0 ? dt : 1 / 60;
        this.integral += error * deltaTime;
        this.integral = THREE.MathUtils.clamp(
            this.integral,
            -this.integralClamp,
            this.integralClamp
        );

        const derivative = (error - this.prevError) / deltaTime;
        this.prevError = error;

        return this.kp * error + this.ki * this.integral + this.kd * derivative;
    }
}
