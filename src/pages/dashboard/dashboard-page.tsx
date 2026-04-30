/**
 * dashboard-page.tsx — Overview dashboard assembling stat cards + recent detections + defect chart.
 *
 * Layout matches gui-mockup.html #page-dashboard:
 *   - 4-column stats grid (Total Inspections, Defects Found, Detection Accuracy, Avg Processing Time)
 *   - Two-column lower grid: Recent Detections (left) | Defect Distribution (right ~340px)
 *
 * Live data sourced from IndexedDB via aggregateStats().
 * Detection Accuracy is static "44.0%" — honest PDF benchmark mAP@0.5 (design constraint D9).
 */

"use client";

import { Images, Target, Timer, TriangleAlert, Wrench } from "lucide-react";
import { useEffect, useState } from "react";

import { aggregateStats } from "@/features/history-store/repository";
import type { AggregateStats } from "@/features/history-store/types";
import { DefectDistributionChart } from "@/widgets/defect-distribution-chart";
import { RecentDetections } from "@/widgets/recent-detections";
import { StatCard } from "@/widgets/stat-card";

export function DashboardPage() {
  const [stats, setStats] = useState<AggregateStats | null>(null);
  const [refreshKey] = useState(0);

  useEffect(() => {
    aggregateStats().then(setStats).catch(console.error);
  }, [refreshKey]);

  const totalInspections = stats?.totalInspections ?? 0;
  const defectsFound = stats?.defectsFound ?? 0;
  const avgMs = stats?.avgInferenceMs ?? 0;

  const defectRate =
    totalInspections > 0
      ? `${((defectsFound / totalInspections) * 100).toFixed(1)}% defect rate`
      : "No data yet";

  const avgSeconds = avgMs > 0 ? `${(avgMs / 1000).toFixed(1)}s` : "—";

  return (
    <main id="main-content" className="overflow-y-auto p-6">
      {/* Page header */}
      <div className="mb-5">
        <h1 className="text-xl font-bold text-fg-primary">Overview</h1>
        <p className="mt-0.5 text-[13px] text-fg-tertiary">
          Real-time pipeline inspection analytics
        </p>
      </div>

      {/* Stats grid — 4 columns */}
      <div
        className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4"
        role="region"
        aria-label="Summary statistics"
      >
        <StatCard
          icon={Wrench}
          value={totalInspections > 0 ? String(totalInspections) : "—"}
          label="Total Inspections"
          delta={totalInspections > 0 ? `${totalInspections} records in store` : undefined}
          deltaDirection="neutral"
          accentColor="oklch(0.72 0.18 55)"
        />

        <StatCard
          icon={TriangleAlert}
          value={defectsFound > 0 ? String(defectsFound) : "—"}
          label="Defects Found"
          delta={defectRate}
          deltaDirection="down"
          accentColor="oklch(0.5 0.22 25)"
        />

        {/* Static honest PDF mAP@0.5 — do NOT change to 94% */}
        <StatCard
          icon={Target}
          value="44.0%"
          label="Detection Accuracy"
          subtitle="PDF benchmark — mAP@0.5"
          deltaDirection="neutral"
          accentColor="oklch(0.62 0.16 80)"
        />

        <StatCard
          icon={Timer}
          value={avgSeconds}
          label="Avg Processing Time"
          delta="Browser WASM inference"
          deltaDirection="neutral"
          accentColor="oklch(0.52 0.15 250)"
        />
      </div>

      {/* Lower grid: recent detections (flex-1) + defect distribution (340px) */}
      <div
        className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_340px]"
        role="region"
        aria-label="Recent detections and defect distribution"
      >
        <section
          className="rounded-lg border border-border-default bg-bg-surface p-5"
          aria-label="Recent detections"
        >
          <div className="mb-4 flex items-center gap-2">
            <Images className="size-4 text-accent" aria-hidden={true} />
            <h2 className="text-[13px] font-semibold uppercase tracking-[0.6px] text-fg-secondary">
              Recent Detections
            </h2>
          </div>
          <RecentDetections refreshKey={refreshKey} />
        </section>

        <section
          className="rounded-lg border border-border-default bg-bg-surface p-5"
          aria-label="Defect distribution by class"
        >
          <div className="mb-4 flex items-center gap-2">
            <TriangleAlert className="size-4 text-accent" aria-hidden={true} />
            <h2 className="text-[13px] font-semibold uppercase tracking-[0.6px] text-fg-secondary">
              Defect Distribution
            </h2>
          </div>
          <DefectDistributionChart refreshKey={refreshKey} />
        </section>
      </div>
    </main>
  );
}
