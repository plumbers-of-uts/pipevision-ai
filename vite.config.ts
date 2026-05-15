import { copyFileSync, mkdirSync, readdirSync } from "node:fs";
import path from "node:path";
import { serwist } from "@serwist/vite";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { type PluginOption, defineConfig } from "vite";

/**
 * Copies onnxruntime-web WASM files to dist/ort/ so the runtime
 * `wasmPaths="/pipevision-ai/ort/"` lookup resolves. ORT 1.26 ships
 * only threaded variants; with numThreads=1 they run single-threaded.
 */
function copyOrtWasm(): PluginOption {
  return {
    name: "pipevision-copy-ort-wasm",
    apply: "build",
    closeBundle() {
      const src = path.resolve(__dirname, "node_modules/onnxruntime-web/dist");
      const dest = path.resolve(__dirname, "dist/ort");
      mkdirSync(dest, { recursive: true });
      const wasms = readdirSync(src).filter(
        (f) => f.startsWith("ort-wasm-simd-threaded") && f.endsWith(".wasm"),
      );
      for (const f of wasms) {
        copyFileSync(path.join(src, f), path.join(dest, f));
      }
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  // GitHub Pages subpath deploy: https://<user>.github.io/pipevision-ai/
  base: "/pipevision-ai/",
  plugins: [
    react(),
    // Tailwind CSS v4 — CSS-first config, no tailwind.config.js needed.
    tailwindcss(),
    copyOrtWasm(),
    // Serwist service worker: precaches app shell, runtime-caches ONNX + ORT WASM.
    serwist({
      swSrc: "src/sw.ts",
      swDest: "sw.js",
      globDirectory: "dist",
      injectionPoint: "self.__SW_MANIFEST",
      rollupFormat: "iife",
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  // Keep ORT out of Vite's pre-bundling — it uses dynamic WASM loading internally.
  optimizeDeps: {
    exclude: ["onnxruntime-web"],
  },
});
