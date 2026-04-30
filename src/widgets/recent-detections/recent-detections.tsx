/**
 * recent-detections.tsx — 3×2 grid of recent inspection thumbnails.
 * Calls recent(6) from IndexedDB on mount.
 * Matches gui-mockup.html .detections-grid and .det-thumb structure.
 */

"use client";

import { useEffect, useState } from "react";

import { recent } from "@/features/history-store/repository";
import type { HistoryRecord } from "@/features/history-store/types";
import { relativeTime } from "@/lib/relative-time";
import { cn } from "@/lib/utils";

type Severity = "critical" | "high" | "medium" | "low";

const SEV_STYLES: Record<Severity | "none", { badge: string; label: string }> = {
  critical: { badge: "bg-[#fde8e8] text-[#d9363e]", label: "Critical" },
  high: { badge: "bg-[#fff0e0] text-[#c05a1a]", label: "High" },
  medium: { badge: "bg-[#fef9e7] text-[#8a6d00]", label: "Medium" },
  low: { badge: "bg-[#e8f8ef] text-[#1a7a3a]", label: "Low" },
  none: { badge: "bg-[#e8f8ef] text-[#1a7a3a]", label: "Pass" },
};

function topSeverity(record: HistoryRecord): Severity | "none" {
  if (record.detections.length === 0) return "none";
  // Priority: critical > high > medium > low
  const order: Severity[] = ["critical", "high", "medium", "low"];
  for (const sev of order) {
    if (record.detections.some((d) => d.severity === sev)) return sev;
  }
  return "low";
}

interface RecentDetectionsProps {
  /** Refresh trigger — increment to re-fetch (e.g., after new detection saved). */
  refreshKey?: number;
}

export function RecentDetections({ refreshKey = 0 }: RecentDetectionsProps) {
  const [records, setRecords] = useState<HistoryRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    recent(6)
      .then((data) => {
        if (!cancelled) {
          setRecords(data);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  if (loading) {
    return (
      <div
        className="grid grid-cols-3 gap-3"
        aria-busy="true"
        aria-label="Loading recent detections"
      >
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton
            key={i}
            className="aspect-[4/3] animate-pulse rounded bg-bg-elevated"
          />
        ))}
      </div>
    );
  }

  if (records.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center text-sm text-fg-tertiary">
        No inspections yet — run a detection to see results here.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-3" role="list" aria-label="Recent detections">
      {records.map((record) => {
        const sev = topSeverity(record);
        const style = SEV_STYLES[sev];
        const topDet = record.detections[0];

        return (
          <article
            key={record.id}
            role="listitem"
            className="group cursor-pointer overflow-hidden rounded border border-border-default transition-colors hover:border-accent"
          >
            {/* Thumbnail */}
            <div className="relative aspect-[4/3] overflow-hidden bg-bg-base">
              <img
                src={record.thumbnailDataUrl}
                alt={topDet ? `${topDet.className} detection` : "Clean pipe inspection"}
                className="size-full object-cover"
                loading="lazy"
              />
            </div>

            {/* Info row */}
            <div className="flex items-center justify-between bg-bg-elevated px-2.5 py-2">
              <div className="min-w-0">
                <div className="truncate text-[11px] font-semibold text-fg-primary">
                  {topDet?.className ?? "Clean"}
                  {topDet && (
                    <span className="ml-1 font-mono text-[10px] text-fg-tertiary">
                      {(topDet.confidence * 100).toFixed(0)}%
                    </span>
                  )}
                </div>
                <div className="text-[10px] text-fg-tertiary">{relativeTime(record.createdAt)}</div>
              </div>
              <span
                className={cn(
                  "ml-2 shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.3px]",
                  style.badge,
                )}
              >
                {style.label}
              </span>
            </div>
          </article>
        );
      })}
    </div>
  );
}
