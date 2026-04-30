/**
 * defect-distribution-chart.tsx — Horizontal bar chart of detections per class.
 * Reads from aggregateByClass() and renders bars styled per PIPEVISION_CLASSES color.
 * Matches gui-mockup.html .bar-chart layout (label | bar track | count).
 */

"use client";

import { useEffect, useState } from "react";

import { PIPEVISION_CLASSES } from "@/features/history-store/classes";
import { aggregateByClass } from "@/features/history-store/repository";

interface ChartRow {
  classId: number;
  name: string;
  color: string;
  count: number;
  percent: number;
}

interface DefectDistributionChartProps {
  refreshKey?: number;
}

export function DefectDistributionChart({ refreshKey = 0 }: DefectDistributionChartProps) {
  const [rows, setRows] = useState<ChartRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    aggregateByClass()
      .then((counts) => {
        if (cancelled) return;
        const total = Object.values(counts).reduce((s, v) => s + v, 0) || 1;
        const built: ChartRow[] = PIPEVISION_CLASSES.map((cls) => ({
          classId: cls.id,
          name: cls.name,
          color: cls.color,
          count: counts[cls.id] ?? 0,
          percent: Math.round(((counts[cls.id] ?? 0) / total) * 100),
        }));
        // Sort by count descending
        built.sort((a, b) => b.count - a.count);
        setRows(built);
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  const maxCount = rows.reduce((m, r) => Math.max(m, r.count), 1);

  if (loading) {
    return (
      <div
        className="flex flex-col gap-2.5"
        aria-busy="true"
        aria-label="Loading defect distribution"
      >
        {Array.from({ length: 7 }).map((_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: skeleton
          <div key={i} className="flex items-center gap-2.5">
            <div className="h-3 w-16 animate-pulse rounded bg-bg-elevated" />
            <div className="h-5 flex-1 animate-pulse rounded bg-bg-elevated" />
            <div className="h-3 w-6 animate-pulse rounded bg-bg-elevated" />
          </div>
        ))}
      </div>
    );
  }

  if (rows.every((r) => r.count === 0)) {
    return (
      <div className="flex h-32 items-center justify-center text-sm text-fg-tertiary">
        No detections recorded yet.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2.5" role="list" aria-label="Defect distribution by class">
      {rows.map((row) => {
        const barWidth = maxCount > 0 ? (row.count / maxCount) * 100 : 0;
        // Short abbreviation for label column (max 3 chars)
        const abbr = row.name.slice(0, 3).toUpperCase();

        return (
          <div
            key={row.classId}
            className="flex items-center gap-2.5"
            role="listitem"
            aria-label={`${row.name}: ${row.count} detections (${row.percent}%)`}
          >
            {/* Label */}
            <div
              className="w-[72px] shrink-0 text-right font-mono text-[11px] text-fg-secondary"
              title={row.name}
            >
              {abbr}
            </div>

            {/* Track */}
            <div className="relative h-5 flex-1 overflow-hidden rounded bg-bg-base">
              <div
                className="flex h-full items-center justify-end rounded pr-1.5 transition-all duration-700"
                style={{
                  width: `${Math.max(barWidth, row.count > 0 ? 4 : 0)}%`,
                  background: row.color,
                }}
                role="progressbar"
                aria-valuenow={row.count}
                aria-valuemin={0}
                aria-valuemax={maxCount}
              >
                {barWidth > 15 && (
                  <span className="text-[10px] font-semibold text-white">{row.percent}%</span>
                )}
              </div>
            </div>

            {/* Count */}
            <div className="w-7 shrink-0 font-mono text-[11px] text-fg-tertiary">{row.count}</div>
          </div>
        );
      })}

      {/* Legend */}
      <div className="mt-3 border-t border-border-default pt-3">
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.5px] text-fg-tertiary">
          Legend
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-1">
          {rows.map((row) => (
            <span key={row.classId} className="text-[10px] text-fg-tertiary">
              <span
                className="mr-0.5 inline-block size-2 rounded-full align-middle"
                style={{ background: row.color }}
                aria-hidden="true"
              />
              {row.name}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
