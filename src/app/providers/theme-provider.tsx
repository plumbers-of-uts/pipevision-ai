import type { ReactNode } from "react";

interface ThemeProviderProps {
  children: ReactNode;
}

/**
 * ThemeProvider — stub for Sprint 2.
 * Will own dark/light theme toggle state in Sprint 5.
 * Currently renders children unchanged (light theme only via globals.css).
 */
export function ThemeProvider({ children }: ThemeProviderProps) {
  return <>{children}</>;
}
