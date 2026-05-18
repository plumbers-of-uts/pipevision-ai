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
 * Each variant has a paired .mjs loader (e.g. jsep.mjs ↔ jsep.wasm) —
 * both must be served from the same path or session create 404s.
 */
function copyOrtWasm(): PluginOption {
  return {
    name: "pipevision-copy-ort-wasm",
    apply: "build",
    closeBundle() {
      const src = path.resolve(__dirname, "node_modules/onnxruntime-web/dist");
      const dest = path.resolve(__dirname, "dist/ort");
      mkdirSync(dest, { recursive: true });
      const artifacts = readdirSync(src).filter(
        (f) =>
          f.startsWith("ort-wasm-simd-threaded") && (f.endsWith(".wasm") || f.endsWith(".mjs")),
      );
      for (const f of artifacts) {
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
