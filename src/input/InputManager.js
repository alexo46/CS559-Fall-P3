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
                event.preventDefault();
                break;
            case "KeyS":
                console.log("Throttle Down:", isDown);
                this.state.throttleDown = isDown;
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

        return this.state;
    }
}
