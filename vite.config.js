import { defineConfig } from "vite";
import wasm from "vite-plugin-wasm";
import topLevelAwait from "vite-plugin-top-level-await";

export default defineConfig({
    plugins: [wasm(), topLevelAwait()],
    base: "/CS559-Fall-P3/",
    build: {
        outDir: "docs",
    },
});
