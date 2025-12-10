import { Engine } from "./core/Engine.js";
import { StartScreen } from "./ui/StartScreen.js";

const container = document.getElementById("app") || document.body;

async function main() {
    const startScreen = new StartScreen();

    startScreen.onStart = async (useDetailedModel, difficulty, totalLaps) => {
        console.log(
            `Starting game with ${
                useDetailedModel ? "detailed" : "basic"
            } model on ${difficulty} difficulty, ${totalLaps} laps`
        );

        const engine = new Engine(container);
        await engine.init(useDetailedModel, difficulty, totalLaps);
        engine.start();
    };
}

main();
