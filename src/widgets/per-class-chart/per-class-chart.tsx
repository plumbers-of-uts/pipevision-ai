/**
 * per-class-chart.tsx — Horizontal recharts bar of mAP@0.5 per class (sorted desc).
 * Highlights worst 2 (Crack, Joint offset) with severity-critical color band.
 * Uses PDF test set numbers. Honest mAP@0.5 = 0.44 overall.
 */

"use client";

import { useEffect, useRef, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, LabelList, Tooltip, XAxis, YAxis } from "recharts";

interface ClassData {
  name: string;
  map50: number;
  worst: boolean;
}

const CLASS_DATA: ClassData[] = [
  { name: "Utility intrusion", map50: 0.708, worst: false },
  { name: "Obstacle", map50: 0.668, worst: false },
  { name: "Debris", map50: 0.416, worst: false },
  { name: "All (avg)", map50: 0.44, worst: false },
  { name: "Hole", map50: 0.379, worst: false },
  { name: "Crack", map50: 0.384, worst: true },
  { name: "Buckling", map50: 0.326, worst: false },
  { name: "Joint offset", map50: 0.196, worst: true },
].sort((a, b) => b.map50 - a.map50);

// DESIGN.md HSL tokens (avoid oklch — recharts SVG renders unreliably with oklch in some browsers)
const ACCENT = "hsl(28, 92%, 52%)"; // --accent
const CRITICAL = "hsl(0, 72%, 45%)"; // --severity-critical
const GRID = "hsl(240, 5%, 88%)"; // --border-default
const TICK = "hsl(220, 8%, 45%)"; // --fg-secondary
const HOVER = "hsl(240, 4%, 93%)"; // --bg-elevated

function CustomTooltip({
  active,
  payload,
}: { active?: boolean; payload?: Array<{ value: number; payload: ClassData }> }) {
  if (!active || !payload?.[0]) return null;
  const { name, map50, worst } = payload[0].payload;
  return (
    <div className="rounded-lg border border-border-default bg-bg-surface px-3 py-2 shadow-md">
      <div className="text-[12px] font-semibold text-fg-primary">{name}</div>
      <div className="font-mono text-[13px] text-fg-secondary">
        mAP@0.5:{" "}
        <span className={worst ? "text-error font-bold" : "text-success font-bold"}>
          {map50.toFixed(3)}
        </span>
      </div>
      {worst && (
        <div className="mt-0.5 text-[11px] text-error">
          Weakest class — candidate for improvement
        </div>
      )}
    </div>
  );
}

export function PerClassChart() {
  // Use a measured-width chart instead of ResponsiveContainer.
  // ResponsiveContainer relies on ResizeObserver, which can fail to fire under
  // headless fullPage screenshot mechanisms — bars then render but the
  // capture happens before the resize cycle completes.
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(900);

  useEffect(() => {
    const measure = () => {
      if (containerRef.current) setWidth(containerRef.current.clientWidth);
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  return (
    <div ref={containerRef}>
      <div className="overflow-hidden">
        <BarChart
          width={width}
          height={280}
          data={CLASS_DATA}
          layout="vertical"
          margin={{ top: 4, right: 56, bottom: 4, left: 108 }}
        >
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={GRID} />
          <XAxis
            type="number"
            domain={[0, 0.8]}
            tickCount={5}
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
          <Bar dataKey="map50" radius={[0, 3, 3, 0]} maxBarSize={22}>
            {CLASS_DATA.map((entry) => (
              <Cell
                key={entry.name}
                fill={entry.worst ? CRITICAL : ACCENT}
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

      {/* Legend */}
      <div className="mt-2 flex gap-4 text-[11px] text-fg-secondary">
        <span className="flex items-center gap-1.5">
          <span
            className="inline-block size-2.5 rounded-sm"
            style={{ background: ACCENT }}
            aria-hidden="true"
          />
          mAP@0.5 score
        </span>
        <span className="flex items-center gap-1.5">
          <span
            className="inline-block size-2.5 rounded-sm"
            style={{ background: CRITICAL }}
            aria-hidden="true"
          />
          Weakest classes (improvement candidates)
        </span>
      </div>
    </div>
  );
}
