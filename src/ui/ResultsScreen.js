export class ResultsScreen {
    constructor({ position, totalLaps, raceTime, bestLapTime, onBackToMenu }) {
        this.onBackToMenu = onBackToMenu;
        this.container = document.createElement("div");
        this.container.id = "results-screen";
        this.setupStyles();
        this.setupContent({ position, totalLaps, raceTime, bestLapTime });
        document.body.appendChild(this.container);
    }

    setupStyles() {
        const style = document.createElement("style");
        style.textContent = `
            #results-screen {
                position: fixed;
                top: 0;
                left: 0;
                width: 100vw;
                height: 100vh;
                background: rgba(0, 0, 0, 0.75);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 1200;
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                color: white;
            }

            .results-panel {
                background: rgba(10, 10, 20, 0.95);
                border-radius: 16px;
                padding: 2.5rem 3.5rem;
                box-shadow: 0 20px 60px rgba(0, 0, 0, 0.6);
                min-width: 360px;
                text-align: center;
            }

            .results-title {
                font-size: 2.2rem;
                font-weight: bold;
                margin-bottom: 1.5rem;
                letter-spacing: 0.15em;
                text-transform: uppercase;
            }

            .results-position {
                font-size: 3.5rem;
                font-weight: bold;
                color: #f1c40f;
                margin-bottom: 0.5rem;
            }

            .results-detail {
                opacity: 0.8;
                margin-bottom: 1.5rem;
                font-size: 0.95rem;
            }

            .results-row {
                display: flex;
                justify-content: space-between;
                margin: 0.4rem 0;
                font-size: 0.95rem;
            }

            .results-label {
                opacity: 0.7;
            }

            .results-value {
                font-family: 'Courier New', monospace;
            }

            .results-button {
                margin-top: 2rem;
                padding: 0.8rem 2.6rem;
                border-radius: 999px;
                border: none;
                background: linear-gradient(135deg, #667eea, #764ba2);
                color: white;
                font-size: 0.95rem;
                font-weight: bold;
                letter-spacing: 0.12em;
                text-transform: uppercase;
                cursor: pointer;
                box-shadow: 0 10px 30px rgba(102, 126, 234, 0.6);
                transition: transform 0.2s ease, box-shadow 0.2s ease;
            }

            .results-button:hover {
                transform: translateY(-2px);
                box-shadow: 0 14px 40px rgba(102, 126, 234, 0.8);
            }
        `;
        document.head.appendChild(style);
    }

    static formatTime(seconds) {
        if (seconds === null || seconds === undefined) return "--:--.---";
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toFixed(3).padStart(6, "0")}`;
    }

    getPositionText(position) {
        if (position === 1) return "1st";
        if (position === 2) return "2nd";
        if (position === 3) return "3rd";
        return `${position}th`;
    }

    setupContent({ position, totalLaps, raceTime, bestLapTime }) {
        const raceTimeStr = ResultsScreen.formatTime(raceTime);
        const bestLapStr = ResultsScreen.formatTime(bestLapTime);

        this.container.innerHTML = `
            <div class="results-panel">
                <div class="results-title">Race Finished</div>
                <div class="results-position">${this.getPositionText(
                    position
                )}</div>
                <div class="results-detail">${totalLaps} lap race</div>

                <div class="results-row">
                    <span class="results-label">Total Time</span>
                    <span class="results-value">${raceTimeStr}</span>
                </div>
                <div class="results-row">
                    <span class="results-label">Best Lap</span>
                    <span class="results-value">${bestLapStr}</span>
                </div>

                <button class="results-button">Back to Main Menu</button>
            </div>
        `;

        const btn = this.container.querySelector(".results-button");
        btn.addEventListener("click", () => {
            if (this.onBackToMenu) {
                this.onBackToMenu();
            } else {
                window.location.reload();
            }
        });
    }
}
