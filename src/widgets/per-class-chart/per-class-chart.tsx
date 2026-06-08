/**
 * per-class-chart.tsx — Horizontal recharts bar of mAP@0.5 per class (sorted desc).
 * Rendered only when the active model exposes `classMetrics`; the fallback below
 * is a placeholder for the 6-class pipeline-defect model whose metrics are pending.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, LabelList, Tooltip, XAxis, YAxis } from "recharts";

interface ClassData {
  name: string;
  map50: number;
}

const FALLBACK_chartData: ClassData[] = [
  { name: "Deformation", map50: 0 },
  { name: "Obstacle", map50: 0 },
  { name: "Rupture", map50: 0 },
  { name: "Disconnect", map50: 0 },
  { name: "Misalignment", map50: 0 },
  { name: "Deposition", map50: 0 },
];

// DESIGN.md HSL tokens (avoid oklch — recharts SVG renders unreliably with oklch in some browsers)
const ACCENT = "hsl(28, 92%, 52%)"; // --accent
const GRID = "hsl(240, 5%, 88%)"; // --border-default
const TICK = "hsl(220, 8%, 45%)"; // --fg-secondary
const HOVER = "hsl(240, 4%, 93%)"; // --bg-elevated

function CustomTooltip({
  active,
  payload,
}: { active?: boolean; payload?: Array<{ value: number; payload: ClassData }> }) {
  if (!active || !payload?.[0]) return null;
  const { name, map50 } = payload[0].payload;
  return (
    <div className="rounded-lg border border-border-default bg-bg-surface px-3 py-2 shadow-md">
      <div className="text-[12px] font-semibold text-fg-primary">{name}</div>
      <div className="font-mono text-[13px] text-fg-secondary">
        mAP@0.5: <span className="font-bold text-fg-primary">{map50.toFixed(3)}</span>
      </div>
    </div>
  );
}

interface PerClassChartProps {
  /** Optional override; defaults to the YOLO26m-seg test-set numbers. */
  data?: readonly ClassData[];
}

export function PerClassChart({ data }: PerClassChartProps = {}) {
  // Use a measured-width chart instead of ResponsiveContainer.
  // ResponsiveContainer relies on ResizeObserver, which can fail to fire under
  // headless fullPage screenshot mechanisms — bars then render but the
  // capture happens before the resize cycle completes.
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(900);
  const chartData = useMemo(
    () => [...(data ?? FALLBACK_chartData)].sort((a, b) => b.map50 - a.map50),
    [data],
  );

  useEffect(() => {
    const measure = () => {
      if (containerRef.current) setWidth(containerRef.current.clientWidth);
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  const safeChartWidth = Math.max(480, width);

  return (
    <div ref={containerRef} className="w-full overflow-x-auto">
      <div style={{ minWidth: `${safeChartWidth}px` }} className="overflow-hidden">
        <BarChart
          width={safeChartWidth}
          height={280}
          data={chartData}
          layout="vertical"
          margin={{ top: 4, right: 56, bottom: 4, left: 108 }}
        >
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={GRID} />
          <XAxis
            type="number"
            domain={[0, 1]}
            tickCount={6}
            tickFormatter={(v: number) => v.toFixed(1)}
            tick={{ fontSize: 11, fontFamily: "var(--font-mono)", fill: TICK }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            type="category"
            dataKey="name"
            width={104}
            tick={{ fontSize: 11, fontFamily: "var(--font-mono)", fill: TICK }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: HOVER }} />
          <Bar dataKey="map50" radius={[0, 3, 3, 0]} maxBarSize={22} fill={ACCENT}>
            {chartData.map((entry) => (
              <Cell
                key={entry.name}
                fill={ACCENT}
                fillOpacity={entry.name === "All (avg)" ? 0.6 : 1}
              />
            ))}
            <LabelList
              dataKey="map50"
              position="right"
              formatter={(v: unknown) => (typeof v === "number" ? v.toFixed(3) : String(v ?? ""))}
              style={{ fontSize: 11, fontFamily: "var(--font-mono)", fill: TICK }}
            />
          </Bar>
        </BarChart>
      </div>
    </div>
  );
}
