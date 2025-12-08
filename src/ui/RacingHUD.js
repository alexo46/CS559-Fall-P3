export class RacingHUD {
    constructor() {
        this.container = document.createElement("div");
        this.container.id = "racing-hud";

        this.currentLap = 1;
        this.totalLaps = 3;
        this.position = 1;
        this.totalCars = 2;
        this.currentLapTime = 0;
        this.bestLapTime = null;
        this.lastLapTime = null;
        this.raceTime = 0;

        this.setupStyles();
        this.setupContent();
        document.body.appendChild(this.container);
    }

    setupStyles() {
        const style = document.createElement("style");
        style.textContent = `
            #racing-hud {
                position: fixed;
                top: 20px;
                left: 20px;
                color: white;
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                user-select: none;
                pointer-events: none;
                z-index: 100;
            }

            .hud-panel {
                background: rgba(0, 0, 0, 0.6);
                backdrop-filter: blur(10px);
                border: 2px solid rgba(255, 255, 255, 0.2);
                border-radius: 8px;
                padding: 1rem;
                margin-bottom: 1rem;
                min-width: 250px;
            }

            .hud-title {
                font-size: 0.8rem;
                text-transform: uppercase;
                letter-spacing: 0.1em;
                opacity: 0.7;
                margin-bottom: 0.5rem;
            }

            .hud-value {
                font-size: 1.8rem;
                font-weight: bold;
                line-height: 1;
            }

            .lap-info {
                display: flex;
                align-items: baseline;
                gap: 0.5rem;
            }

            .lap-current {
                font-size: 3rem;
                font-weight: bold;
                color: #4a90e2;
            }

            .lap-total {
                font-size: 1.2rem;
                opacity: 0.6;
            }

            .position-display {
                font-size: 3rem;
                font-weight: bold;
                color: #f39c12;
            }

            .position-suffix {
                font-size: 1.5rem;
                margin-left: 0.2rem;
            }

            .time-value {
                font-family: 'Courier New', monospace;
                font-size: 1.5rem;
                color: #2ecc71;
            }

            .time-label {
                font-size: 0.7rem;
                opacity: 0.6;
                margin-right: 0.5rem;
            }

            .best-lap {
                color: #e74c3c;
            }

            .last-lap {
                color: #9b59b6;
            }

            .hud-row {
                display: flex;
                align-items: baseline;
                margin-top: 0.5rem;
            }
        `;
        document.head.appendChild(style);
    }

    setupContent() {
        this.container.innerHTML = `
            <div class="hud-panel">
                <div class="hud-title">Lap</div>
                <div class="lap-info">
                    <span class="lap-current" id="hud-current-lap">1</span>
                    <span class="lap-total" id="hud-total-laps">/ 3</span>
                </div>
            </div>

            <div class="hud-panel">
                <div class="hud-title">Position</div>
                <div class="position-display">
                    <span id="hud-position">1</span><span class="position-suffix" id="hud-position-suffix">st</span>
                    <span style="font-size: 1.2rem; opacity: 0.6; margin-left: 0.3rem;" id="hud-total-cars">/ 2</span>
                </div>
            </div>

            <div class="hud-panel">
                <div class="hud-title">Current Lap</div>
                <div class="time-value" id="hud-current-time">0:00.000</div>
                
                <div class="hud-row">
                    <span class="time-label">Last:</span>
                    <span class="time-value last-lap" id="hud-last-lap">--:--.---</span>
                </div>
                
                <div class="hud-row">
                    <span class="time-label">Best:</span>
                    <span class="time-value best-lap" id="hud-best-lap">--:--.---</span>
                </div>
            </div>

            <div class="hud-panel">
                <div class="hud-title">Race Time</div>
                <div class="time-value" id="hud-race-time">0:00.000</div>
            </div>
        `;

        // Cache element references after content is added to DOM
        this.elements = {
            currentLap: this.container.querySelector("#hud-current-lap"),
            totalLaps: this.container.querySelector("#hud-total-laps"),
            position: this.container.querySelector("#hud-position"),
            positionSuffix: this.container.querySelector(
                "#hud-position-suffix"
            ),
            totalCars: this.container.querySelector("#hud-total-cars"),
            currentTime: this.container.querySelector("#hud-current-time"),
            lastLap: this.container.querySelector("#hud-last-lap"),
            bestLap: this.container.querySelector("#hud-best-lap"),
            raceTime: this.container.querySelector("#hud-race-time"),
        };
    }

    formatTime(seconds) {
        if (seconds === null || seconds === undefined) return "--:--.---";
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toFixed(3).padStart(6, "0")}`;
    }

    getPositionSuffix(pos) {
        const suffixes = ["th", "st", "nd", "rd"];
        const v = pos % 100;
        return suffixes[(v - 20) % 10] || suffixes[v] || suffixes[0];
    }

    updateLap(current, total = this.totalLaps) {
        this.currentLap = current;
        this.totalLaps = total;
        this.elements.currentLap.textContent = current;
        this.elements.totalLaps.textContent = `/ ${total}`;
    }

    updatePosition(position, total = this.totalCars) {
        this.position = position;
        this.totalCars = total;
        this.elements.position.textContent = position;
        this.elements.positionSuffix.textContent =
            this.getPositionSuffix(position);
        this.elements.totalCars.textContent = `/ ${total}`;
    }

    updateCurrentLapTime(seconds) {
        this.currentLapTime = seconds;
        this.elements.currentTime.textContent = this.formatTime(seconds);
    }

    updateLastLapTime(seconds) {
        this.lastLapTime = seconds;
        this.elements.lastLap.textContent = this.formatTime(seconds);
    }

    updateBestLapTime(seconds) {
        this.bestLapTime = seconds;
        this.elements.bestLap.textContent = this.formatTime(seconds);
    }

    updateRaceTime(seconds) {
        this.raceTime = seconds;
        this.elements.raceTime.textContent = this.formatTime(seconds);
    }

    set visible(value) {
        this.container.style.display = value ? "block" : "none";
    }

    reset() {
        this.currentLap = 1;
        this.currentLapTime = 0;
        this.lastLapTime = null;
        this.bestLapTime = null;
        this.raceTime = 0;
        this.updateLap(1);
        this.updatePosition(1);
        this.updateCurrentLapTime(0);
        this.updateLastLapTime(null);
        this.updateBestLapTime(null);
        this.updateRaceTime(0);
    }
}
