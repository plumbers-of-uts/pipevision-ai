/**
 * defect-distribution-chart.tsx — Donut chart of detections per class.
 * Reads from aggregateByClass(), renders severity-colored slices with the
 * total in the center and a legend list below (color / name / percent / count).
 */

import { useRequest } from "ahooks";
import { Cell, Pie, PieChart, Tooltip } from "recharts";

import { useDemoSeed } from "@/app/providers/seed-provider";
import { PIPEVISION_CLASSES } from "@/features/history-store/classes";
import { aggregateByClass } from "@/features/history-store/repository";

interface ChartRow {
  classId: number;
  name: string;
  color: string;
  count: number;
  percent: number;
}

interface ChartData {
  rows: ChartRow[];
  total: number;
}

interface DefectDistributionChartProps {
  refreshKey?: number;
}

async function fetchChartData(): Promise<ChartData> {
  const counts = await aggregateByClass();
  const total = Object.values(counts).reduce((s, v) => s + v, 0);
  const safeTotal = total || 1;
  const rows = PIPEVISION_CLASSES.map((cls) => ({
    classId: cls.id,
    name: cls.name,
    color: cls.color,
    count: counts[cls.id] ?? 0,
    percent: Math.round(((counts[cls.id] ?? 0) / safeTotal) * 100),
  }))
    .filter((r) => r.count > 0)
    .sort((a, b) => b.count - a.count);
  return { rows, total };
}

function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: ChartRow }>;
}) {
  if (!active || !payload?.[0]) return null;
  const { name, count, percent } = payload[0].payload;
  return (
    <div className="rounded-lg border border-border-default bg-bg-surface px-3 py-2 shadow-md">
      <div className="text-[12px] font-semibold text-fg-primary">{name}</div>
      <div className="font-mono text-[12px] text-fg-secondary">
        {count} <span className="text-fg-tertiary">({percent}%)</span>
      </div>
    </div>
  );
}

export function DefectDistributionChart({ refreshKey }: DefectDistributionChartProps = {}) {
  const { status: seedStatus } = useDemoSeed();
  const { data, loading } = useRequest(fetchChartData, {
    refreshDeps: [seedStatus, refreshKey],
  });
  const rows = data?.rows ?? [];
  const total = data?.total ?? 0;

  if (loading) {
    return (
      <div
        className="flex flex-col items-center gap-4"
        aria-busy="true"
        aria-label="Loading defect distribution"
      >
        <div className="size-[180px] animate-pulse rounded-full bg-bg-elevated" />
        <div className="flex w-full flex-col gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: skeleton
            <div key={i} className="h-4 w-full animate-pulse rounded bg-bg-elevated" />
          ))}
        </div>
      </div>
    );
  }

  if (total === 0) {
    return (
      <div className="flex h-32 items-center justify-center text-sm text-fg-tertiary">
        No detections recorded yet.
      </div>
    );
  }

  return (
    <div
      className="flex flex-col items-center gap-4"
      role="group"
      aria-label="Defect distribution by class"
    >
      <div className="relative">
        <PieChart width={180} height={180}>
          <Pie
            data={rows}
            dataKey="count"
            nameKey="name"
            cx="50%"
            cy="50%"
            innerRadius={52}
            outerRadius={86}
            paddingAngle={1}
            stroke="hsl(0, 0%, 100%)"
            strokeWidth={2}
            isAnimationActive={false}
          >
            {rows.map((row) => (
              <Cell key={row.classId} fill={row.color} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
        </PieChart>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-mono text-[22px] font-bold leading-none text-fg-primary">
            {total}
          </span>
          <span className="mt-1 text-[10px] uppercase tracking-[0.5px] text-fg-tertiary">
            Total
          </span>
        </div>
      </div>

      <ul className="flex w-full flex-col gap-1.5">
        {rows.map((row) => (
          <li
            key={row.classId}
            className="flex items-center gap-2 text-[11px]"
            aria-label={`${row.name}: ${row.count} detections (${row.percent}%)`}
          >
            <span
              className="size-2.5 shrink-0 rounded-sm"
              style={{ background: row.color }}
              aria-hidden="true"
            />
            <span className="flex-1 truncate text-fg-secondary" title={row.name}>
              {row.name}
            </span>
            <span className="w-8 text-right font-mono text-fg-tertiary">{row.percent}%</span>
            <span className="w-7 text-right font-mono text-fg-primary">{row.count}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
