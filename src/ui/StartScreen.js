export class StartScreen {
    constructor() {
        this.container = document.createElement("div");
        this.container.id = "start-screen";
        this.setupStyles();
        this.setupContent();
        document.body.appendChild(this.container);
        this.onStart = null;
    }

    setupStyles() {
        const style = document.createElement("style");
        style.textContent = `
            #start-screen {
                position: fixed;
                top: 0;
                left: 0;
                width: 100vw;
                height: 100vh;
                background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                z-index: 1000;
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                color: white;
            }

            .start-screen-title {
                font-size: 4rem;
                font-weight: bold;
                margin-bottom: 1rem;
                text-shadow: 0 0 20px rgba(255, 255, 255, 0.3);
                letter-spacing: 0.1em;
            }

            .start-screen-subtitle {
                font-size: 1.2rem;
                margin-bottom: 3rem;
                opacity: 0.8;
            }

            .detail-selection {
                display: flex;
                gap: 2rem;
                margin-bottom: 3rem;
            }

            .detail-option {
                background: rgba(255, 255, 255, 0.1);
                border: 2px solid rgba(255, 255, 255, 0.3);
                border-radius: 12px;
                padding: 2rem 3rem;
                cursor: pointer;
                transition: all 0.3s ease;
                min-width: 200px;
                text-align: center;
            }

            .detail-option:hover {
                background: rgba(255, 255, 255, 0.2);
                border-color: rgba(255, 255, 255, 0.6);
                transform: translateY(-5px);
                box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
            }

            .detail-option.selected {
                background: rgba(74, 144, 226, 0.3);
                border-color: #4a90e2;
                box-shadow: 0 0 20px rgba(74, 144, 226, 0.5);
            }

            .difficulty-selection {
                display: flex;
                gap: 1.5rem;
                margin-bottom: 2rem;
            }

            .difficulty-button {
                padding: 0.6rem 1.4rem;
                border-radius: 999px;
                border: 1px solid rgba(255, 255, 255, 0.3);
                background: rgba(0, 0, 0, 0.25);
                color: white;
                cursor: pointer;
                font-size: 0.9rem;
                letter-spacing: 0.08em;
                text-transform: uppercase;
                transition: all 0.2s ease;
            }

            .difficulty-button.selected {
                background: #4a90e2;
                border-color: #4a90e2;
                box-shadow: 0 0 14px rgba(74, 144, 226, 0.7);
            }

            .laps-selection {
                display: flex;
                align-items: center;
                gap: 1rem;
                margin-bottom: 2rem;
                font-size: 0.95rem;
                opacity: 0.9;
            }

            .laps-label {
                text-transform: uppercase;
                letter-spacing: 0.12em;
                font-size: 0.8rem;
                opacity: 0.8;
            }

            .laps-button {
                padding: 0.4rem 0.9rem;
                border-radius: 999px;
                border: 1px solid rgba(255, 255, 255, 0.3);
                background: rgba(0, 0, 0, 0.25);
                color: white;
                cursor: pointer;
                font-size: 0.9rem;
                letter-spacing: 0.08em;
                text-transform: uppercase;
                transition: all 0.2s ease;
            }

            .laps-button.selected {
                background: #4a90e2;
                border-color: #4a90e2;
                box-shadow: 0 0 14px rgba(74, 144, 226, 0.6);
            }

            .detail-title {
                font-size: 1.8rem;
                font-weight: bold;
                margin-bottom: 0.5rem;
            }

            .detail-description {
                font-size: 0.9rem;
                opacity: 0.7;
                line-height: 1.4;
            }

            .start-button {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                border: none;
                border-radius: 50px;
                padding: 1.2rem 4rem;
                font-size: 1.5rem;
                font-weight: bold;
                color: white;
                cursor: pointer;
                transition: all 0.3s ease;
                text-transform: uppercase;
                letter-spacing: 0.15em;
                box-shadow: 0 10px 30px rgba(102, 126, 234, 0.4);
            }

            .start-button:hover {
                transform: translateY(-3px);
                box-shadow: 0 15px 40px rgba(102, 126, 234, 0.6);
            }

            .start-button:active {
                transform: translateY(-1px);
            }

            .start-button:disabled {
                opacity: 0.5;
                cursor: not-allowed;
                transform: none;
            }

            .controls-info {
                position: absolute;
                bottom: 2rem;
                text-align: center;
                opacity: 0.6;
                font-size: 0.9rem;
            }

            .controls-info div {
                margin: 0.3rem 0;
            }
        `;
        document.head.appendChild(style);
    }

    setupContent() {
        this.container.innerHTML = `
            <div class="start-screen-title">RACING SIMULATOR</div>
            <div class="start-screen-subtitle">Select graphics quality and start your race</div>
            
            <div class="detail-selection">
                <div class="detail-option" data-detail="basic">
                    <div class="detail-title">Basic</div>
                    <div class="detail-description">
                        Simple car model<br/>
                        Better performance<br/>
                        Faster loading
                    </div>
                </div>
                <div class="detail-option" data-detail="detailed">
                    <div class="detail-title">Detailed</div>
                    <div class="detail-description">
                        High-quality car model<br/>
                        Enhanced visuals<br/>
                        Realistic appearance
                    </div>
                </div>
            </div>

            <div class="difficulty-selection">
                <button class="difficulty-button" data-difficulty="easy">Easy</button>
                <button class="difficulty-button selected" data-difficulty="medium">Medium</button>
                <button class="difficulty-button" data-difficulty="hard">Hard</button>
            </div>

            <div class="laps-selection">
                <span class="laps-label">Laps</span>
                <button class="laps-button" data-laps="1">1</button>
                <button class="laps-button selected" data-laps="3">3</button>
                <button class="laps-button" data-laps="5">5</button>
            </div>

            <button class="start-button" disabled>START RACE</button>

            <div class="controls-info">
                <div><strong>W/S</strong> - Throttle/Brake | <strong>A/D</strong> - Steer | <strong>Space</strong> - Handbrake</div>
                <div><strong>F3</strong> - Toggle Debug Panel</div>
            </div>
        `;

        this.selectedDetail = null;
        this.selectedDifficulty = "medium";
        this.selectedLaps = 3;
        this.startButton = this.container.querySelector(".start-button");

        const options = this.container.querySelectorAll(".detail-option");
        options.forEach((option) => {
            option.addEventListener("click", () => {
                this.selectDetail(option.dataset.detail);
                options.forEach((o) => o.classList.remove("selected"));
                option.classList.add("selected");
            });
        });

        const difficultyButtons =
            this.container.querySelectorAll(".difficulty-button");
        difficultyButtons.forEach((btn) => {
            btn.addEventListener("click", () => {
                this.selectedDifficulty = btn.dataset.difficulty;
                difficultyButtons.forEach((b) =>
                    b.classList.toggle("selected", b === btn)
                );
            });
        });

        const lapsButtons = this.container.querySelectorAll(".laps-button");
        lapsButtons.forEach((btn) => {
            btn.addEventListener("click", () => {
                const laps = parseInt(btn.dataset.laps, 10) || 3;
                this.selectedLaps = laps;
                lapsButtons.forEach((b) =>
                    b.classList.toggle("selected", b === btn)
                );
            });
        });

        this.startButton.addEventListener("click", () => {
            if (this.selectedDetail && this.onStart) {
                this.hide();
                this.onStart(
                    this.selectedDetail === "detailed",
                    this.selectedDifficulty,
                    this.selectedLaps
                );
            }
        });
    }

    selectDetail(detail) {
        this.selectedDetail = detail;
        this.startButton.disabled = false;
    }

    hide() {
        this.container.style.display = "none";
    }

    show() {
        this.container.style.display = "flex";
    }
}
