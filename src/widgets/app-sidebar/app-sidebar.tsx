import { Cpu, History, LayoutDashboard, ScanSearch } from "lucide-react";
import { NavLink } from "react-router-dom";

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

/**
 * AppSidebar — left navigation sidebar.
 * Structure mirrors gui-mockup.html lines 644-665.
 * Icons: lucide-react (LayoutDashboard, ScanSearch, History, Cpu).
 * Active state: accent left border + bg-overlay background.
 * Hover state: bg-elevated background.
 */
export function AppSidebar() {
  return (
    <aside
      className="flex h-screen w-[240px] shrink-0 flex-col border-r border-border-default bg-bg-surface"
      aria-label="Primary sidebar"
    >
      {/* Logo */}
      <div className="flex items-center gap-3 border-b border-border-default px-5 py-4">
        <div
          className="flex size-9 shrink-0 items-center justify-center rounded-md bg-accent text-fg-inverse text-lg font-bold"
          aria-hidden="true"
        >
          P
        </div>
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-fg-primary">PipeVision AI</div>
          <div className="truncate text-xs text-fg-secondary">Sewer Defect Detection</div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4" aria-label="Main navigation">
        <ul className="space-y-0.5">
          {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
            <li key={to}>
              <NavLink
                to={to}
                end={to === "/"}
                className={({ isActive }: { isActive: boolean }) =>
                  [
                    "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors duration-150",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus focus-visible:ring-offset-1",
                    isActive
                      ? "border-l-[3px] border-accent bg-bg-overlay pl-[9px] text-fg-primary"
                      : "border-l-[3px] border-transparent text-fg-secondary hover:bg-bg-elevated hover:text-fg-primary",
                  ].join(" ")
                }
              >
                {({ isActive }: { isActive: boolean }) => (
                  <>
                    <Icon
                      className={isActive ? "text-accent" : "text-fg-tertiary"}
                      aria-hidden={true}
                    />
                    <span>{label}</span>
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      {/* Bottom slot — model-status-pill placeholder (Sprint 3, T3.7 will replace this) */}
      {/* TODO (Sprint 3): Replace static pill with live ModelProvider state from model-provider.tsx */}
      <div className="border-t border-border-default px-4 py-3.5" data-testid="sidebar-bottom-slot">
        <div className="flex items-center gap-2 text-[11px] text-fg-tertiary">
          <span
            className="inline-block size-[7px] shrink-0 rounded-full bg-success shadow-[0_0_6px_currentColor] text-success"
            aria-hidden="true"
          />
          <span>Model: Demo Mode</span>
        </div>
      </div>
    </aside>
  );
}
