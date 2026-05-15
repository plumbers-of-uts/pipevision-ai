import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { App } from "./app/app";
import { registerServiceWorker } from "./lib/onnx/sw-register";
import "./styles/globals.css";

const rootElement = document.getElementById("root");
if (rootElement === null) {
  throw new Error(
    "Root element #root not found. Ensure index.html contains <div id='root'></div>.",
  );
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Register Serwist service worker in production only.
// Caches ONNX model + ORT WASM cache-first per the C8' contract.
registerServiceWorker();
