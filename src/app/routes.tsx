import type { RouteObject } from "react-router-dom";

import { CreditsPage } from "@/pages/credits";
import { DashboardPage } from "@/pages/dashboard";
import { DetectPage } from "@/pages/detect";
import { HistoryPage } from "@/pages/history";
import { ModelsPage } from "@/pages/models";

/**
 * Route configuration for the FlowBust SPA.
 * HashRouter is used for GitHub Pages compatibility (no server-side routing needed).
 *
 * Route map:
 *   /           → DashboardPage
 *   /detect     → DetectPage
 *   /history    → HistoryPage
 *   /models     → ModelsPage
 *   /credits    → CreditsPage
 */
export const routes: RouteObject[] = [
  { index: true, element: <DashboardPage /> },
  { path: "detect", element: <DetectPage /> },
  { path: "history", element: <HistoryPage /> },
  { path: "models", element: <ModelsPage /> },
  { path: "credits", element: <CreditsPage /> },
];
