export class ControlState {
    constructor() {
        this.throttle = 0;
        this.throttleUp = false;
        this.throttleDown = false;
        this.forward = false;
        this.backward = false;
        this.left = false;
        this.right = false;
        this.handbrake = false;
        this.drive = 0;
        this.steer = 0;
        this.brake = false;
    }
}
