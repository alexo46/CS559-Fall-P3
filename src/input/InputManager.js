import { ControlState } from "./ControlState.js";

export class InputManager {
    constructor(target = window) {
        this.state = new ControlState();
        this.target = target;
        this.throttleRate = 0.75; // throttle change per second

        this.keyDownHandler = (event) => this.handleKey(event, true);
        this.keyUpHandler = (event) => this.handleKey(event, false);

        this.target.addEventListener("keydown", this.keyDownHandler);
        this.target.addEventListener("keyup", this.keyUpHandler);
    }

    dispose() {
        this.target.removeEventListener("keydown", this.keyDownHandler);
        this.target.removeEventListener("keyup", this.keyUpHandler);
    }

    handleKey(event, isDown) {
        if (event.repeat) return;

        switch (event.code) {
            case "KeyW":
                console.log("Throttle Up:", isDown);
                this.state.throttleUp = isDown;
                this.state.forward = isDown;
                event.preventDefault();
                break;
            case "KeyS":
                console.log("Throttle Down:", isDown);
                this.state.throttleDown = isDown;
                this.state.backward = isDown;
                event.preventDefault();
                break;
            case "KeyA":
                this.state.left = isDown;
                event.preventDefault();
                break;
            case "KeyD":
                this.state.right = isDown;
                event.preventDefault();
                break;
            case "Space":
                this.state.handbrake = isDown;
                event.preventDefault();
                break;
            default:
                break;
        }
    }

    update(dt) {
        const delta = this.throttleRate * dt;

        if (this.state.throttleUp) {
            this.state.throttle = Math.min(1, this.state.throttle + delta);
        }
        if (this.state.throttleDown) {
            this.state.throttle = Math.max(0, this.state.throttle - delta);
        }

        const forward = this.state.forward ? 1 : 0;
        const backward = this.state.backward ? 1 : 0;
        this.state.drive = Math.max(-1, Math.min(1, forward - backward));

        const left = this.state.left ? 1 : 0;
        const right = this.state.right ? 1 : 0;
        this.state.steer = Math.max(-1, Math.min(1, right - left));

        this.state.brake = Boolean(this.state.handbrake);

        return this.state;
    }
}
