import { Engine } from "./core/Engine.js";

const container = document.getElementById("app") || document.body;

const engine = new Engine(container);
engine.start();
