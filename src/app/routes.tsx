import type { RouteObject } from "react-router-dom";

import { DashboardPage } from "@/pages/dashboard";
import { DetectPage } from "@/pages/detect";
import { HistoryPage } from "@/pages/history";
import { ModelsPage } from "@/pages/models";

/**
 * Route configuration for the PipeVision AI SPA.
 * HashRouter is used for GitHub Pages compatibility (no server-side routing needed).
 *
 * Route map:
 *   /           → DashboardPage
 *   /detect     → DetectPage
 *   /history    → HistoryPage
 *   /models     → ModelsPage
 */
export const routes: RouteObject[] = [
  { index: true, element: <DashboardPage /> },
  { path: "detect", element: <DetectPage /> },
  { path: "history", element: <HistoryPage /> },
  { path: "models", element: <ModelsPage /> },
];
