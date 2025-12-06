import { Engine } from "./core/Engine.js";

const container = document.getElementById("app") || document.body;

async function main() {
    const engine = new Engine(container);
    await engine.init(); // waits for World.init (track + car)
    engine.start();
}

main();
