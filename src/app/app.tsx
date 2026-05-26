import { Camera, Cpu, History, LayoutDashboard, Menu, ScanSearch } from "lucide-react";
import { useState } from "react";
import { HashRouter, useLocation, useNavigate, useRoutes } from "react-router-dom";

import { cn } from "@/lib/utils";
import { AppSidebar } from "@/widgets/app-sidebar";

import { ModelProvider } from "./providers/model-provider";
import { SeedProvider } from "./providers/seed-provider";
import { ThemeProvider } from "./providers/theme-provider";
import { routes } from "./routes";

interface NavItem {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
}

const NAV_ITEMS: NavItem[] = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/detect", label: "Detect", icon: ScanSearch },
  { to: "/history", label: "History", icon: History },
  { to: "/models", label: "Model Info", icon: Cpu },
];

/** Inner component that consumes the router context. */
function AppContent() {
  const element = useRoutes(routes);
  const location = useLocation();
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Determine current page title based on path
  const getPageTitle = () => {
    switch (location.pathname) {
      case "/":
        return "Dashboard";
      case "/detect":
        return "Detect";
      case "/history":
        return "History";
      case "/models":
        return "Model Info";
      default:
        return "PipeVision AI";
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-bg-base">
      {/* Sidebar Backdrop for Mobile/Tablet */}
      {isMobileMenuOpen && (
        <div
          role="presentation"
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
          onKeyDown={(e) => {
            if (e.key === "Escape" || e.key === "Enter" || e.key === " ") {
              setIsMobileMenuOpen(false);
            }
          }}
        />
      )}

      {/* Sidebar - Persistent on large screens, Drawer on small screens */}
      <div
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex h-full transition-transform duration-300 lg:static lg:z-auto lg:translate-x-0",
          isMobileMenuOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
        )}
      >
        <AppSidebar onItemClick={() => setIsMobileMenuOpen(false)} />
      </div>

      {/* Main Content Area */}
      <div className="flex min-w-0 flex-1 flex-col h-full overflow-hidden">
        {/* Mobile Top Bar (height 56px) - hidden on Desktop */}
        <header className="flex h-[56px] shrink-0 items-center justify-between border-b border-border-default bg-bg-surface px-4 lg:hidden">
          <button
            type="button"
            onClick={() => setIsMobileMenuOpen(true)}
            className="rounded p-1.5 text-fg-secondary hover:bg-bg-elevated hover:text-fg-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
            aria-label="Open sidebar"
          >
            <Menu className="size-5" />
          </button>

          <h1 className="text-sm font-semibold text-fg-primary">{getPageTitle()}</h1>

          <button
            type="button"
            onClick={() => navigate("/detect")}
            className="rounded p-1.5 text-fg-secondary hover:bg-bg-elevated hover:text-fg-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
            aria-label="Quick detect"
          >
            <Camera className="size-5" />
          </button>
        </header>

        {/* Scrollable content pane */}
        <main id="main-content" className="flex-1 overflow-y-auto min-h-0 pb-[56px] lg:pb-0">
          {element}
        </main>

        {/* Mobile Bottom Navigation (height 56px) - hidden on Desktop */}
        <nav
          className="fixed bottom-0 left-0 right-0 z-30 flex h-[56px] border-t border-border-default bg-bg-surface lg:hidden"
          aria-label="Mobile navigation"
        >
          {NAV_ITEMS.map(({ to, label, icon: Icon }) => {
            const isActive =
              to === "/" ? location.pathname === "/" : location.pathname.startsWith(to);
            return (
              <button
                key={to}
                type="button"
                onClick={() => navigate(to)}
                className="flex flex-1 flex-col items-center justify-center gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus cursor-pointer"
              >
                <Icon
                  className={cn("size-5", isActive ? "text-accent" : "text-fg-tertiary")}
                  aria-hidden={true}
                />
                <span
                  className={cn(
                    "text-[10px] font-medium leading-none",
                    isActive ? "text-fg-primary" : "text-fg-tertiary",
                  )}
                >
                  {label}
                </span>
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );
}

/**
 * App — top-level component.
 * Wraps the entire application with:
 *   - ThemeProvider (stub — Sprint 2; dark/light toggle in Sprint 5)
 *   - ModelProvider (stub — Sprint 2; full ORT state machine in Sprint 3)
 *   - HashRouter (GitHub Pages compatible, no server-side routing)
 */
export function App() {
  return (
    <ThemeProvider>
      <ModelProvider>
        <SeedProvider>
          <HashRouter>
            {/* Skip-to-content link for keyboard/screen-reader users (DESIGN.md §6.1) */}
            <a href="#main-content" className="skip-to-content">
              Skip to main content
            </a>

            <AppContent />
          </HashRouter>
        </SeedProvider>
      </ModelProvider>
    </ThemeProvider>
  );
}
