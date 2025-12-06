export class VehicleDebugPanel {
    constructor() {
        this.container = document.createElement("div");
        this.container.style.position = "absolute";
        this.container.style.top = "20px";
        this.container.style.left = "20px";
        this.container.style.padding = "12px 16px";
        this.container.style.background = "rgba(0, 0, 0, 0.6)";
        this.container.style.borderRadius = "8px";
        this.container.style.fontFamily = "Consolas, 'Courier New', monospace";
        this.container.style.fontSize = "12px";
        this.container.style.color = "#00ff9d";
        this.container.style.whiteSpace = "pre";
        this.container.style.pointerEvents = "none";
        this.container.style.zIndex = "100";
        document.body.appendChild(this.container);

        this.visible = false;
    }

    set visible(value) {
        this._visible = value;
        if (this.container) {
            this.container.style.display = value ? "block" : "none";
        }
    }

    get visible() {
        return this._visible;
    }

    update(debugData) {
        if (!this._visible || !debugData) return;

        const lines = [];
        lines.push(`Speed: ${debugData.speedMph.toFixed(1)} mph`);
        lines.push(
            `Local vel -> forward: ${debugData.forwardSpeed.toFixed(
                2
            )} m/s, lateral: ${debugData.lateralSpeed.toFixed(2)} m/s`
        );
        lines.push(
            `Inputs -> throttle: ${debugData.engineInput.toFixed(
                2
            )}, brake: ${debugData.brakeInput.toFixed(
                2
            )}, steer: ${debugData.steerInput.toFixed(2)}`
        );
        lines.push(
            `Gear: ${debugData.gear}  RPM: ${Math.round(
                debugData.rpm
            )}  EngineForce: ${debugData.engineForce.toFixed(1)}`
        );
        lines.push(
            `Downforce: ${debugData.downforce.toFixed(
                1
            )}N  Drag: ${debugData.drag.toFixed(1)}N`
        );
        lines.push("Wheels:");

        debugData.wheels.forEach((wheel, idx) => {
            lines.push(
                `  ${wheel.label} | contact: ${
                    wheel.inContact ? "yes" : "no"
                } | compression: ${wheel.compression.toFixed(
                    3
                )}m | length: ${wheel.length.toFixed(3)}m`
            );
        });

        this.container.textContent = lines.join("\n");
    }
}
