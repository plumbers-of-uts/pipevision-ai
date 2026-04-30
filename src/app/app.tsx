import { HashRouter, useRoutes } from "react-router-dom";

import { AppSidebar } from "@/widgets/app-sidebar";

import { ModelProvider } from "./providers/model-provider";
import { ThemeProvider } from "./providers/theme-provider";
import { routes } from "./routes";

/** Inner component that consumes the router context. */
function AppRoutes() {
  const element = useRoutes(routes);
  return element;
}

/**
 * App — top-level component.
 * Wraps the entire application with:
 *   - ThemeProvider (stub — Sprint 2; dark/light toggle in Sprint 5)
 *   - ModelProvider (stub — Sprint 2; full ORT state machine in Sprint 3)
 *   - HashRouter (GitHub Pages compatible, no server-side routing)
 *
 * Layout:
 *   [AppSidebar 240px fixed] | [Route content flex-1]
 */
export function App() {
  return (
    <ThemeProvider>
      <ModelProvider>
        <HashRouter>
          {/* Skip-to-content link for keyboard/screen-reader users (DESIGN.md §6.1) */}
          <a href="#main-content" className="skip-to-content">
            Skip to main content
          </a>

          <div className="flex min-h-screen bg-bg-base">
            <AppSidebar />

            {/* Main content — grows to fill remaining space */}
            <div className="flex min-w-0 flex-1 flex-col overflow-auto">
              <AppRoutes />
            </div>
          </div>
        </HashRouter>
      </ModelProvider>
    </ThemeProvider>
  );
}
