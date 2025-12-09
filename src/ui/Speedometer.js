export class Speedometer {
    constructor() {
        this.container = document.createElement("div");
        this.container.style.position = "absolute";
        this.container.style.bottom = "30px";
        this.container.style.right = "30px";
        this.container.style.width = "500px";
        this.container.style.height = "280px";
        this.container.style.userSelect = "none";
        this.container.style.pointerEvents = "none";

        this.canvas = document.createElement("canvas");
        this.canvas.width = 500;
        this.canvas.height = 280;
        this.container.appendChild(this.canvas);
        this.ctx = this.canvas.getContext("2d");

        document.body.appendChild(this.container);
        this.currentSpeed = 0;
        this.targetSpeed = 0;
        this.rpm = 0;
        this.currentGear = 1;
    }

    set visible(value) {
        this.container.style.display = value ? "block" : "none";
    }

    updateSpeed(speedMph) {
        this.targetSpeed = Math.abs(speedMph);

        // Smooth needle movement
        this.currentSpeed += (this.targetSpeed - this.currentSpeed) * 0.15;
    }

    updateRPM(rpm) {
        this.rpm = rpm;
    }

    draw() {
        const ctx = this.ctx;

        ctx.clearRect(0, 0, 500, 280);

        // Draw RPM gauge on the left
        this.drawRPMGauge(ctx, 120, 140, 110);

        // Draw speedometer on the right
        this.drawSpeedometer(ctx, 370, 140, 125);

        // Draw current gear in the center
        this.drawGear(ctx, 250, 200);
    }

    drawRPMGauge(ctx, centerX, centerY, radius) {
        // Draw outer bezel
        const bezelGradient = ctx.createRadialGradient(
            centerX,
            centerY,
            radius - 20,
            centerX,
            centerY,
            radius + 10
        );
        bezelGradient.addColorStop(0, "#2a2a2a");
        bezelGradient.addColorStop(0.8, "#1a1a1a");
        bezelGradient.addColorStop(1, "#0a0a0a");
        ctx.fillStyle = bezelGradient;
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius + 10, 0, Math.PI * 2);
        ctx.fill();

        // Draw gauge face
        const faceGradient = ctx.createRadialGradient(
            centerX,
            centerY,
            0,
            centerX,
            centerY,
            radius
        );
        faceGradient.addColorStop(0, "#1a1a1a");
        faceGradient.addColorStop(1, "#000000");
        ctx.fillStyle = faceGradient;
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        ctx.fill();

        const maxRPM = 8;
        const startAngle = Math.PI * 0.75;
        const endAngle = Math.PI * 2.25;
        const angleRange = endAngle - startAngle;

        // Draw RPM markings
        for (let rpm = 0; rpm <= maxRPM; rpm++) {
            const angle = startAngle + (rpm / maxRPM) * angleRange;
            const isMainMark = true;
            const markLength = 15;

            const x1 = centerX + Math.cos(angle) * (radius - 8);
            const y1 = centerY + Math.sin(angle) * (radius - 8);
            const x2 = centerX + Math.cos(angle) * (radius - 8 - markLength);
            const y2 = centerY + Math.sin(angle) * (radius - 8 - markLength);

            // Redline at 7-8
            ctx.strokeStyle = rpm >= 7 ? "#ff0000" : "#ffffff";
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.stroke();

            // Draw RPM numbers
            ctx.fillStyle = rpm >= 7 ? "#ff0000" : "#ffffff";
            ctx.font = "italic bold 18px Arial";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            const textRadius = radius - 35;
            const textX = centerX + Math.cos(angle) * textRadius;
            const textY = centerY + Math.sin(angle) * textRadius;
            ctx.fillText(rpm.toString(), textX, textY);
        }

        // Draw RPM needle shadow
        const rpmAngle =
            startAngle +
            (Math.min(this.rpm / 1000, maxRPM) / maxRPM) * angleRange;
        ctx.strokeStyle = "rgba(0, 0, 0, 0.5)";
        ctx.lineWidth = 4;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(centerX + 2, centerY + 2);
        ctx.lineTo(
            centerX + Math.cos(rpmAngle) * (radius - 25) + 2,
            centerY + Math.sin(rpmAngle) * (radius - 25) + 2
        );
        ctx.stroke();

        // Draw RPM needle
        ctx.strokeStyle = "#ff0000";
        ctx.lineWidth = 3;
        ctx.shadowColor = "#ff0000";
        ctx.shadowBlur = 15;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.lineTo(
            centerX + Math.cos(rpmAngle) * (radius - 25),
            centerY + Math.sin(rpmAngle) * (radius - 25)
        );
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Draw center cap
        const capGradient = ctx.createRadialGradient(
            centerX,
            centerY,
            0,
            centerX,
            centerY,
            12
        );
        capGradient.addColorStop(0, "#444444");
        capGradient.addColorStop(1, "#1a1a1a");
        ctx.fillStyle = capGradient;
        ctx.beginPath();
        ctx.arc(centerX, centerY, 12, 0, Math.PI * 2);
        ctx.fill();

        // Draw center dot
        ctx.fillStyle = "#ff0000";
        ctx.beginPath();
        ctx.arc(centerX, centerY, 4, 0, Math.PI * 2);
        ctx.fill();

        // RPM label
        ctx.fillStyle = "#999999";
        ctx.font = "italic bold 11px Arial";
        ctx.textAlign = "center";
        ctx.fillText("RPM x1000", centerX, centerY + 55);
    }

    drawGear(ctx, centerX, centerY) {
        // drawing number of current gear
        const gear = this.currentGear;
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 48px Arial";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(gear.toString(), centerX, centerY);
    }

    drawSpeedometer(ctx, centerX, centerY, radius) {
        // Draw outer bezel
        const bezelGradient = ctx.createRadialGradient(
            centerX,
            centerY,
            radius - 20,
            centerX,
            centerY,
            radius + 10
        );
        bezelGradient.addColorStop(0, "#2a2a2a");
        bezelGradient.addColorStop(0.8, "#1a1a1a");
        bezelGradient.addColorStop(1, "#0a0a0a");
        ctx.fillStyle = bezelGradient;
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius + 10, 0, Math.PI * 2);
        ctx.fill();

        // Draw gauge face
        const faceGradient = ctx.createRadialGradient(
            centerX,
            centerY,
            0,
            centerX,
            centerY,
            radius
        );
        faceGradient.addColorStop(0, "#1a1a1a");
        faceGradient.addColorStop(1, "#000000");
        ctx.fillStyle = faceGradient;
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        ctx.fill();

        // Draw speed markings
        const maxSpeed = 180;
        const startAngle = Math.PI * 0.75;
        const endAngle = Math.PI * 2.25;
        const angleRange = endAngle - startAngle;

        ctx.save();

        for (let speed = 0; speed <= maxSpeed; speed += 10) {
            const angle = startAngle + (speed / maxSpeed) * angleRange;
            const isMainMark = speed % 20 === 0;
            const markLength = isMainMark ? 20 : 12;

            const x1 = centerX + Math.cos(angle) * (radius - 8);
            const y1 = centerY + Math.sin(angle) * (radius - 8);
            const x2 = centerX + Math.cos(angle) * (radius - 8 - markLength);
            const y2 = centerY + Math.sin(angle) * (radius - 8 - markLength);

            // Color marks red in danger zone (above 140)
            if (speed > 140) {
                ctx.strokeStyle = "#ff0000";
            } else {
                ctx.strokeStyle = "#ffffff";
            }

            ctx.lineWidth = isMainMark ? 3 : 2;
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.stroke();

            // Draw speed numbers
            if (isMainMark && speed % 20 === 0) {
                ctx.fillStyle = "#ffffff";
                ctx.font = "italic bold 18px Arial";
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";
                const textRadius = radius - 45;
                const textX = centerX + Math.cos(angle) * textRadius;
                const textY = centerY + Math.sin(angle) * textRadius;
                ctx.fillText(speed.toString(), textX, textY);
            }
        }
        ctx.restore();

        // Draw needle shadow
        const needleAngle =
            startAngle +
            (Math.min(this.currentSpeed, maxSpeed) / maxSpeed) * angleRange;
        ctx.strokeStyle = "rgba(0, 0, 0, 0.5)";
        ctx.lineWidth = 5;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(centerX + 2, centerY + 2);
        ctx.lineTo(
            centerX + Math.cos(needleAngle) * (radius - 25) + 2,
            centerY + Math.sin(needleAngle) * (radius - 25) + 2
        );
        ctx.stroke();

        // Draw main needle
        ctx.strokeStyle = "#ff0000";
        ctx.lineWidth = 4;
        ctx.shadowColor = "#ff0000";
        ctx.shadowBlur = 15;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.lineTo(
            centerX + Math.cos(needleAngle) * (radius - 25),
            centerY + Math.sin(needleAngle) * (radius - 25)
        );
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Draw center cap
        const capGradient = ctx.createRadialGradient(
            centerX,
            centerY,
            0,
            centerX,
            centerY,
            15
        );
        capGradient.addColorStop(0, "#444444");
        capGradient.addColorStop(1, "#1a1a1a");
        ctx.fillStyle = capGradient;
        ctx.beginPath();
        ctx.arc(centerX, centerY, 15, 0, Math.PI * 2);
        ctx.fill();

        // Draw center dot
        ctx.fillStyle = "#ff0000";
        ctx.beginPath();
        ctx.arc(centerX, centerY, 5, 0, Math.PI * 2);
        ctx.fill();

        // Draw digital display
        ctx.fillStyle = "rgba(0, 0, 0, 0.9)";
        ctx.fillRect(centerX - 45, centerY + 80, 90, 32);

        ctx.fillStyle = "#00ff00";
        ctx.shadowColor = "#00ff00";
        ctx.shadowBlur = 8;
        ctx.font = "bold 28px 'Courier New', monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(
            Math.round(this.currentSpeed).toString(),
            centerX,
            centerY + 96
        );
        ctx.shadowBlur = 0;

        // Draw "MPH" label
        ctx.fillStyle = "#999999";
        ctx.font = "italic bold 11px Arial";
        ctx.fillText("MPH", centerX, centerY + 70);
    }
}
