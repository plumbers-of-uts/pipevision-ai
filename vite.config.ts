import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// https://vitejs.dev/config/
export default defineConfig({
  // GitHub Pages subpath deploy: https://<user>.github.io/pipevision-ai/
  base: "/pipevision-ai/",
  plugins: [
    react(),
    // Tailwind CSS v4 — CSS-first config, no tailwind.config.js needed.
    // v4 is used here (not v3) because DESIGN.md Appendix B already provides
    // @theme block with oklch tokens for Tailwind v4 CSS-first config.
    tailwindcss(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
