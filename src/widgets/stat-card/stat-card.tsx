/**
 * stat-card.tsx — Metric summary card for the Dashboard stat grid.
 *
 * Matches gui-mockup.html .stat-card with top accent bar, icon, value, label.
 * accentColor is a CSS color value (oklch, hsl, hex) applied to the top border
 * and icon background.
 */

import type { LucideIcon } from "lucide-react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";

import { cn } from "@/lib/utils";

interface StatCardProps {
  icon: LucideIcon;
  value: string;
  label: string;
  subtitle?: string;
  delta?: string;
  deltaDirection?: "up" | "down" | "neutral";
  accentColor: string;
  className?: string;
}

export function StatCard({
  icon: Icon,
  value,
  label,
  subtitle,
  delta,
  deltaDirection = "neutral",
  accentColor,
  className,
}: StatCardProps) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-lg border border-border-default bg-bg-surface p-5 transition-colors hover:border-border-hover",
        className,
      )}
      style={
        {
          "--accent-color": accentColor,
        } as React.CSSProperties
      }
    >
      {/* Top accent bar */}
      <div
        className="absolute inset-x-0 top-0 h-[2px]"
        style={{ background: accentColor }}
        aria-hidden="true"
      />

      {/* Icon */}
      <div
        className="mb-3 flex size-[38px] items-center justify-center rounded-lg"
        style={{
          background: `color-mix(in srgb, ${accentColor} 15%, transparent)`,
        }}
        aria-hidden="true"
      >
        <Icon className="size-4" style={{ color: accentColor }} aria-hidden={true} />
      </div>

      {/* Value */}
      <div
        className="font-mono text-[26px] font-bold leading-none text-fg-primary"
        aria-label={`${label}: ${value}`}
      >
        {value}
      </div>

      {/* Label */}
      <div className="mt-1 text-[11px] font-medium uppercase tracking-[0.5px] text-fg-tertiary">
        {label}
      </div>

      {/* Subtitle (static note, e.g., "PDF benchmark") */}
      {subtitle && <div className="mt-1 text-[11px] text-fg-tertiary">{subtitle}</div>}

      {/* Delta */}
      {delta && (
        <div
          className={cn("mt-1.5 flex items-center gap-1 text-[11px]", {
            "text-success": deltaDirection === "up",
            "text-error": deltaDirection === "down",
            "text-fg-tertiary": deltaDirection === "neutral",
          })}
          aria-label={`Trend: ${delta}`}
        >
          {deltaDirection === "up" && <ArrowUpRight className="size-3" aria-hidden={true} />}
          {deltaDirection === "down" && <ArrowDownRight className="size-3" aria-hidden={true} />}
          <span>{delta}</span>
        </div>
      )}
    </div>
  );
}
