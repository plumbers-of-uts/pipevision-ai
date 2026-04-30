/**
 * training-curve-chart.tsx — Recharts line chart: train_loss, val_loss, mAP@0.5 vs epoch.
 *
 * Mock data: plausible YOLOv8m training run (57 epochs to best checkpoint).
 * - train_loss: starts ~3.5, declines to ~0.95 by epoch 57, plateaus
 * - val_loss:   starts ~3.8, declines to ~1.10 by epoch 57, slight overfit after
 * - mAP@0.5:    starts 0, climbs to 0.44 by epoch 57, small plateau/wiggle after
 *
 * Best checkpoint at epoch 57 marked with a ReferenceLine.
 */

"use client";

import {
  CartesianGrid,
  Label,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface EpochPoint {
  epoch: number;
  trainLoss: number;
  valLoss: number;
  map50: number;
}

/** Smooth exponential-decay curve with mild noise injected deterministically. */
function buildCurveData(): EpochPoint[] {
  const points: EpochPoint[] = [];
  const EPOCHS = 100;
  const BEST = 57;

  for (let e = 0; e <= EPOCHS; e++) {
    // Deterministic noise: small sine + cosine perturbation
    const noise = Math.sin(e * 0.7) * 0.04 + Math.cos(e * 1.3) * 0.03;
    const noiseV = Math.sin(e * 0.5 + 1) * 0.05 + Math.cos(e * 1.1 + 2) * 0.04;

    // Loss decay: exponential with plateau
    const decay = Math.exp(-e / 22);
    const trainLoss = +(0.95 + 2.55 * decay + noise).toFixed(3);

    // Val loss follows but slightly higher + subtle overfit after best epoch
    const overfit = e > BEST ? (e - BEST) * 0.003 : 0;
    const valLoss = +(1.1 + 2.7 * Math.exp(-e / 20) + noiseV + overfit).toFixed(3);

    // mAP rises with diminishing returns, best at epoch 57 = 0.44
    const mapMax = 0.44;
    const mapRise = mapMax * (1 - Math.exp(-e / 18));
    // Slight decay after best checkpoint (overfitting)
    const mapDecay = e > BEST ? (e - BEST) * 0.0012 : 0;
    const mapNoise = Math.sin(e * 0.9 + 0.5) * 0.008;
    const map50 = +Math.max(0, Math.min(mapMax, mapRise - mapDecay + mapNoise)).toFixed(4);

    points.push({ epoch: e, trainLoss, valLoss, map50 });
  }
  return points;
}

const CURVE_DATA = buildCurveData();

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: number;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border-default bg-bg-surface px-3 py-2 shadow-md text-[12px]">
      <div className="mb-1 font-semibold text-fg-primary">Epoch {label}</div>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2 text-fg-secondary">
          <span
            className="inline-block size-2 rounded-full"
            style={{ background: p.color }}
            aria-hidden="true"
          />
          <span>{p.name}:</span>
          <span className="font-mono font-medium" style={{ color: p.color }}>
            {p.value.toFixed(3)}
          </span>
        </div>
      ))}
    </div>
  );
}

export function TrainingCurveChart() {
  return (
    <div>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={CURVE_DATA} margin={{ top: 8, right: 16, bottom: 24, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.9 0.005 280)" />

          <XAxis
            dataKey="epoch"
            type="number"
            domain={[0, 100]}
            tickCount={11}
            tick={{ fontSize: 11, fontFamily: "var(--font-mono)", fill: "oklch(0.68 0.008 250)" }}
            axisLine={false}
            tickLine={false}
          >
            <Label
              value="Epoch"
              position="insideBottomRight"
              offset={-4}
              style={{ fontSize: 11, fill: "oklch(0.68 0.008 250)" }}
            />
          </XAxis>

          {/* Left Y-axis: loss */}
          <YAxis
            yAxisId="loss"
            domain={[0.5, 4]}
            tickCount={8}
            tickFormatter={(v: number) => v.toFixed(1)}
            tick={{ fontSize: 11, fontFamily: "var(--font-mono)", fill: "oklch(0.68 0.008 250)" }}
            axisLine={false}
            tickLine={false}
            width={36}
          />

          {/* Right Y-axis: mAP */}
          <YAxis
            yAxisId="map"
            orientation="right"
            domain={[0, 0.55]}
            tickCount={6}
            tickFormatter={(v: number) => v.toFixed(2)}
            tick={{ fontSize: 11, fontFamily: "var(--font-mono)", fill: "oklch(0.68 0.008 250)" }}
            axisLine={false}
            tickLine={false}
            width={40}
          />

          <Tooltip content={<CustomTooltip />} />

          <Legend
            verticalAlign="top"
            height={28}
            wrapperStyle={{ fontSize: 11, fontFamily: "var(--font-sans)" }}
          />

          {/* Best checkpoint reference line at epoch 57 */}
          <ReferenceLine
            yAxisId="loss"
            x={57}
            stroke="oklch(0.56 0.2 40)"
            strokeDasharray="4 3"
            strokeWidth={1.5}
            label={{
              value: "Best ckpt (ep 57)",
              position: "insideTopRight",
              style: { fontSize: 10, fill: "oklch(0.56 0.2 40)", fontFamily: "var(--font-mono)" },
            }}
          />

          <Line
            yAxisId="loss"
            type="monotone"
            dataKey="trainLoss"
            name="Train Loss"
            stroke="oklch(0.72 0.18 55)"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />

          <Line
            yAxisId="loss"
            type="monotone"
            dataKey="valLoss"
            name="Val Loss"
            stroke="oklch(0.52 0.15 250)"
            strokeWidth={2}
            strokeDasharray="5 3"
            dot={false}
            activeDot={{ r: 4 }}
          />

          <Line
            yAxisId="map"
            type="monotone"
            dataKey="map50"
            name="mAP@0.5"
            stroke="oklch(0.56 0.15 160)"
            strokeWidth={2.5}
            dot={false}
            activeDot={{ r: 4 }}
          />
        </LineChart>
      </ResponsiveContainer>

      {/* Summary note */}
      <p className="mt-2 text-center text-[11px] text-fg-tertiary">
        Best checkpoint saved at epoch 57 — mAP@0.5 = 0.440 · val_loss = 1.10
      </p>
    </div>
  );
}
