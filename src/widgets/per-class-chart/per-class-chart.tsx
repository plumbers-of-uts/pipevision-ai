/**
 * per-class-chart.tsx — Horizontal recharts bar of mAP@0.5 per class (sorted desc).
 * Highlights worst 2 (Crack, Joint offset) with severity-critical color band.
 * Uses PDF test set numbers. Honest mAP@0.5 = 0.44 overall.
 */

"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

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

const ACCENT = "oklch(0.72 0.18 55)"; // accent orange
const CRITICAL = "oklch(0.5 0.22 25)"; // severity-critical red

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
  return (
    <div>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart
          data={CLASS_DATA}
          layout="vertical"
          margin={{ top: 4, right: 56, bottom: 4, left: 108 }}
        >
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="oklch(0.9 0.005 280)" />
          <XAxis
            type="number"
            domain={[0, 0.8]}
            tickCount={5}
            tickFormatter={(v: number) => v.toFixed(1)}
            tick={{ fontSize: 11, fontFamily: "var(--font-mono)", fill: "oklch(0.68 0.008 250)" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            type="category"
            dataKey="name"
            width={104}
            tick={{ fontSize: 11, fontFamily: "var(--font-mono)", fill: "oklch(0.5 0.01 250)" }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: "oklch(0.94 0.003 280)" }} />
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
              style={{ fontSize: 11, fontFamily: "var(--font-mono)", fill: "oklch(0.5 0.01 250)" }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>

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
