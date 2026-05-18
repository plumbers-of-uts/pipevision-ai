/**
 * training-curve-chart.tsx — Recharts line chart of train_loss, val_loss
 * and mAP@0.5 vs epoch, plotted from the actual run logged in
 * `cnn-assignment3/model/results.csv` (158 unique epochs, 43–200).
 *
 * Best checkpoint at epoch 114 (Ultralytics fitness max) is marked with a
 * ReferenceLine. The 1–42 prefix is absent because the training run was
 * resumed from a checkpoint that did not include those rows.
 */

import { useEffect, useRef, useState } from "react";
import {
  CartesianGrid,
  Label,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
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

/**
 * Real training metrics — train/box_loss, val/box_loss, metrics/mAP50(B).
 * Dedup'd by epoch (last row wins for the few resumed-run duplicates).
 * Source: `cnn-assignment3/model/results.csv`.
 */
const CURVE_DATA: EpochPoint[] = [
  { epoch: 43, trainLoss: 1.30294, map50: 0.34939, valLoss: 1.77389 },
  { epoch: 44, trainLoss: 1.19239, map50: 0.36918, valLoss: 1.72659 },
  { epoch: 45, trainLoss: 1.25617, map50: 0.40103, valLoss: 1.75371 },
  { epoch: 46, trainLoss: 1.29101, map50: 0.27332, valLoss: 1.85119 },
  { epoch: 47, trainLoss: 1.25376, map50: 0.35743, valLoss: 1.78901 },
  { epoch: 48, trainLoss: 1.33692, map50: 0.25205, valLoss: 1.84942 },
  { epoch: 49, trainLoss: 1.36216, map50: 0.3308, valLoss: 1.68052 },
  { epoch: 50, trainLoss: 1.32246, map50: 0.34152, valLoss: 1.79558 },
  { epoch: 51, trainLoss: 1.33961, map50: 0.36374, valLoss: 1.75742 },
  { epoch: 52, trainLoss: 1.33782, map50: 0.40394, valLoss: 1.71139 },
  { epoch: 53, trainLoss: 1.33165, map50: 0.38113, valLoss: 1.69282 },
  { epoch: 54, trainLoss: 1.34068, map50: 0.36453, valLoss: 1.71364 },
  { epoch: 55, trainLoss: 1.31093, map50: 0.30589, valLoss: 1.75803 },
  { epoch: 56, trainLoss: 1.30923, map50: 0.38222, valLoss: 1.69 },
  { epoch: 57, trainLoss: 1.32144, map50: 0.27793, valLoss: 1.81352 },
  { epoch: 58, trainLoss: 1.31613, map50: 0.3847, valLoss: 1.72837 },
  { epoch: 59, trainLoss: 1.33136, map50: 0.38189, valLoss: 1.75864 },
  { epoch: 60, trainLoss: 1.30254, map50: 0.37702, valLoss: 1.68312 },
  { epoch: 61, trainLoss: 1.30505, map50: 0.35345, valLoss: 1.7109 },
  { epoch: 62, trainLoss: 1.26727, map50: 0.42116, valLoss: 1.75058 },
  { epoch: 63, trainLoss: 1.32161, map50: 0.37982, valLoss: 1.74008 },
  { epoch: 64, trainLoss: 1.28928, map50: 0.34135, valLoss: 1.73243 },
  { epoch: 65, trainLoss: 1.29348, map50: 0.39217, valLoss: 1.71605 },
  { epoch: 66, trainLoss: 1.26497, map50: 0.42422, valLoss: 1.68336 },
  { epoch: 67, trainLoss: 1.29347, map50: 0.39757, valLoss: 1.68011 },
  { epoch: 68, trainLoss: 1.31257, map50: 0.41913, valLoss: 1.71526 },
  { epoch: 69, trainLoss: 1.26994, map50: 0.43029, valLoss: 1.72865 },
  { epoch: 70, trainLoss: 1.2481, map50: 0.41593, valLoss: 1.72129 },
  { epoch: 71, trainLoss: 1.26079, map50: 0.42337, valLoss: 1.74654 },
  { epoch: 72, trainLoss: 1.29325, map50: 0.38461, valLoss: 1.77089 },
  { epoch: 73, trainLoss: 1.24884, map50: 0.3986, valLoss: 1.64137 },
  { epoch: 74, trainLoss: 1.2481, map50: 0.40845, valLoss: 1.72858 },
  { epoch: 75, trainLoss: 1.20652, map50: 0.41889, valLoss: 1.72798 },
  { epoch: 76, trainLoss: 1.22411, map50: 0.40784, valLoss: 1.72174 },
  { epoch: 77, trainLoss: 1.2091, map50: 0.41878, valLoss: 1.71859 },
  { epoch: 78, trainLoss: 1.21741, map50: 0.38512, valLoss: 1.70201 },
  { epoch: 79, trainLoss: 1.21478, map50: 0.37577, valLoss: 1.72327 },
  { epoch: 80, trainLoss: 1.20919, map50: 0.40262, valLoss: 1.72852 },
  { epoch: 81, trainLoss: 1.22398, map50: 0.38471, valLoss: 1.73957 },
  { epoch: 82, trainLoss: 1.23444, map50: 0.37512, valLoss: 1.78353 },
  { epoch: 83, trainLoss: 1.23067, map50: 0.39199, valLoss: 1.73187 },
  { epoch: 84, trainLoss: 1.20508, map50: 0.39858, valLoss: 1.78545 },
  { epoch: 85, trainLoss: 1.25782, map50: 0.39548, valLoss: 1.71928 },
  { epoch: 86, trainLoss: 1.2029, map50: 0.39688, valLoss: 1.76016 },
  { epoch: 87, trainLoss: 1.20122, map50: 0.35528, valLoss: 1.81498 },
  { epoch: 88, trainLoss: 1.23741, map50: 0.40837, valLoss: 1.78052 },
  { epoch: 89, trainLoss: 1.19595, map50: 0.41217, valLoss: 1.74687 },
  { epoch: 90, trainLoss: 1.20838, map50: 0.43451, valLoss: 1.76178 },
  { epoch: 91, trainLoss: 1.2071, map50: 0.41281, valLoss: 1.73562 },
  { epoch: 92, trainLoss: 1.17861, map50: 0.42402, valLoss: 1.76419 },
  { epoch: 93, trainLoss: 1.18996, map50: 0.41931, valLoss: 1.74628 },
  { epoch: 94, trainLoss: 1.19755, map50: 0.39168, valLoss: 1.77016 },
  { epoch: 95, trainLoss: 1.16046, map50: 0.37997, valLoss: 1.82268 },
  { epoch: 96, trainLoss: 1.20287, map50: 0.40295, valLoss: 1.77095 },
  { epoch: 97, trainLoss: 1.15086, map50: 0.42818, valLoss: 1.76184 },
  { epoch: 98, trainLoss: 1.15591, map50: 0.38174, valLoss: 1.78046 },
  { epoch: 99, trainLoss: 1.11812, map50: 0.37907, valLoss: 1.71864 },
  { epoch: 100, trainLoss: 1.1427, map50: 0.36995, valLoss: 1.7367 },
  { epoch: 101, trainLoss: 1.16223, map50: 0.41323, valLoss: 1.71506 },
  { epoch: 102, trainLoss: 1.12126, map50: 0.41613, valLoss: 1.7627 },
  { epoch: 103, trainLoss: 1.11866, map50: 0.38868, valLoss: 1.7672 },
  { epoch: 104, trainLoss: 1.06288, map50: 0.38267, valLoss: 1.77876 },
  { epoch: 105, trainLoss: 1.09333, map50: 0.37332, valLoss: 1.79339 },
  { epoch: 106, trainLoss: 1.04708, map50: 0.37683, valLoss: 1.74991 },
  { epoch: 107, trainLoss: 1.09833, map50: 0.42599, valLoss: 1.73141 },
  { epoch: 108, trainLoss: 1.10016, map50: 0.4049, valLoss: 1.72847 },
  { epoch: 109, trainLoss: 1.07076, map50: 0.41788, valLoss: 1.74042 },
  { epoch: 110, trainLoss: 1.07814, map50: 0.39372, valLoss: 1.75817 },
  { epoch: 111, trainLoss: 1.06842, map50: 0.43438, valLoss: 1.71547 },
  { epoch: 112, trainLoss: 1.05076, map50: 0.40277, valLoss: 1.75841 },
  { epoch: 113, trainLoss: 1.05315, map50: 0.4088, valLoss: 1.70387 },
  { epoch: 114, trainLoss: 1.04506, map50: 0.42573, valLoss: 1.77959 },
  { epoch: 115, trainLoss: 1.06058, map50: 0.40844, valLoss: 1.76392 },
  { epoch: 116, trainLoss: 1.03098, map50: 0.40188, valLoss: 1.7601 },
  { epoch: 117, trainLoss: 1.0479, map50: 0.4099, valLoss: 1.75749 },
  { epoch: 118, trainLoss: 1.03868, map50: 0.41095, valLoss: 1.79099 },
  { epoch: 119, trainLoss: 1.02461, map50: 0.39715, valLoss: 1.83369 },
  { epoch: 120, trainLoss: 1.0337, map50: 0.41986, valLoss: 1.78784 },
  { epoch: 121, trainLoss: 1.02105, map50: 0.41675, valLoss: 1.85599 },
  { epoch: 122, trainLoss: 0.98279, map50: 0.42574, valLoss: 1.81749 },
  { epoch: 123, trainLoss: 0.96025, map50: 0.41559, valLoss: 1.82713 },
  { epoch: 124, trainLoss: 0.92643, map50: 0.41375, valLoss: 1.83567 },
  { epoch: 125, trainLoss: 0.96728, map50: 0.4079, valLoss: 1.82735 },
  { epoch: 126, trainLoss: 0.91505, map50: 0.3998, valLoss: 1.75812 },
  { epoch: 127, trainLoss: 0.9495, map50: 0.39355, valLoss: 1.80296 },
  { epoch: 128, trainLoss: 0.94424, map50: 0.41743, valLoss: 1.75821 },
  { epoch: 129, trainLoss: 0.92461, map50: 0.40937, valLoss: 1.79058 },
  { epoch: 130, trainLoss: 0.92368, map50: 0.40142, valLoss: 1.8144 },
  { epoch: 131, trainLoss: 0.90786, map50: 0.40967, valLoss: 1.79839 },
  { epoch: 132, trainLoss: 0.89873, map50: 0.41451, valLoss: 1.83317 },
  { epoch: 133, trainLoss: 0.89582, map50: 0.42227, valLoss: 1.79526 },
  { epoch: 134, trainLoss: 0.91615, map50: 0.40194, valLoss: 1.82734 },
  { epoch: 135, trainLoss: 0.89665, map50: 0.39688, valLoss: 1.79491 },
  { epoch: 136, trainLoss: 0.88417, map50: 0.38971, valLoss: 1.80885 },
  { epoch: 137, trainLoss: 0.90261, map50: 0.39519, valLoss: 1.84434 },
  { epoch: 138, trainLoss: 0.89749, map50: 0.40132, valLoss: 1.83295 },
  { epoch: 139, trainLoss: 0.87522, map50: 0.40555, valLoss: 1.81627 },
  { epoch: 140, trainLoss: 0.88441, map50: 0.38083, valLoss: 1.8276 },
  { epoch: 141, trainLoss: 0.882, map50: 0.38151, valLoss: 1.84827 },
  { epoch: 142, trainLoss: 0.94487, map50: 0.36829, valLoss: 1.80734 },
  { epoch: 143, trainLoss: 0.93252, map50: 0.38362, valLoss: 1.79255 },
  { epoch: 144, trainLoss: 0.9539, map50: 0.40339, valLoss: 1.79015 },
  { epoch: 145, trainLoss: 0.91854, map50: 0.38845, valLoss: 1.80599 },
  { epoch: 146, trainLoss: 0.93449, map50: 0.39408, valLoss: 1.78896 },
  { epoch: 147, trainLoss: 0.95338, map50: 0.38962, valLoss: 1.78871 },
  { epoch: 148, trainLoss: 0.89795, map50: 0.40254, valLoss: 1.76764 },
  { epoch: 149, trainLoss: 0.91308, map50: 0.37852, valLoss: 1.76975 },
  { epoch: 150, trainLoss: 0.88359, map50: 0.39862, valLoss: 1.74945 },
  { epoch: 151, trainLoss: 0.94344, map50: 0.39052, valLoss: 1.80051 },
  { epoch: 152, trainLoss: 0.93018, map50: 0.39838, valLoss: 1.79147 },
  { epoch: 153, trainLoss: 0.9045, map50: 0.4001, valLoss: 1.80576 },
  { epoch: 154, trainLoss: 0.87219, map50: 0.39224, valLoss: 1.81383 },
  { epoch: 155, trainLoss: 0.88417, map50: 0.39924, valLoss: 1.80144 },
  { epoch: 156, trainLoss: 0.89045, map50: 0.3929, valLoss: 1.80997 },
  { epoch: 157, trainLoss: 0.87236, map50: 0.39429, valLoss: 1.79876 },
  { epoch: 158, trainLoss: 0.88749, map50: 0.39344, valLoss: 1.79587 },
  { epoch: 159, trainLoss: 0.87464, map50: 0.39822, valLoss: 1.81618 },
  { epoch: 160, trainLoss: 0.86729, map50: 0.40253, valLoss: 1.79114 },
  { epoch: 161, trainLoss: 0.89461, map50: 0.38058, valLoss: 1.79397 },
  { epoch: 162, trainLoss: 0.87575, map50: 0.36393, valLoss: 1.79961 },
  { epoch: 163, trainLoss: 0.85694, map50: 0.38005, valLoss: 1.8082 },
  { epoch: 164, trainLoss: 0.79041, map50: 0.37747, valLoss: 1.81291 },
  { epoch: 165, trainLoss: 0.77789, map50: 0.37755, valLoss: 1.83169 },
  { epoch: 166, trainLoss: 0.75257, map50: 0.37653, valLoss: 1.82977 },
  { epoch: 167, trainLoss: 0.7914, map50: 0.38053, valLoss: 1.81853 },
  { epoch: 168, trainLoss: 0.7336, map50: 0.37385, valLoss: 1.80302 },
  { epoch: 169, trainLoss: 0.77373, map50: 0.37658, valLoss: 1.8479 },
  { epoch: 170, trainLoss: 0.77519, map50: 0.38591, valLoss: 1.84104 },
  { epoch: 171, trainLoss: 0.75633, map50: 0.37729, valLoss: 1.81852 },
  { epoch: 172, trainLoss: 0.75721, map50: 0.37414, valLoss: 1.81834 },
  { epoch: 173, trainLoss: 0.7484, map50: 0.38659, valLoss: 1.82734 },
  { epoch: 174, trainLoss: 0.73341, map50: 0.3886, valLoss: 1.82818 },
  { epoch: 175, trainLoss: 0.74772, map50: 0.37996, valLoss: 1.84392 },
  { epoch: 176, trainLoss: 0.75568, map50: 0.37417, valLoss: 1.82518 },
  { epoch: 177, trainLoss: 0.74776, map50: 0.38313, valLoss: 1.82163 },
  { epoch: 178, trainLoss: 0.7339, map50: 0.37213, valLoss: 1.82624 },
  { epoch: 179, trainLoss: 0.75388, map50: 0.37584, valLoss: 1.82912 },
  { epoch: 180, trainLoss: 0.73244, map50: 0.36963, valLoss: 1.82857 },
  { epoch: 181, trainLoss: 0.89132, map50: 0.37929, valLoss: 1.85848 },
  { epoch: 182, trainLoss: 0.8837, map50: 0.38465, valLoss: 1.84881 },
  { epoch: 183, trainLoss: 0.83459, map50: 0.38322, valLoss: 1.84162 },
  { epoch: 184, trainLoss: 0.83703, map50: 0.389, valLoss: 1.85075 },
  { epoch: 185, trainLoss: 0.85244, map50: 0.38407, valLoss: 1.82923 },
  { epoch: 186, trainLoss: 0.8481, map50: 0.38219, valLoss: 1.83251 },
  { epoch: 187, trainLoss: 0.8604, map50: 0.39514, valLoss: 1.82566 },
  { epoch: 188, trainLoss: 0.84231, map50: 0.39183, valLoss: 1.83376 },
  { epoch: 189, trainLoss: 0.83204, map50: 0.39446, valLoss: 1.8382 },
  { epoch: 190, trainLoss: 0.8337, map50: 0.39454, valLoss: 1.81677 },
  { epoch: 191, trainLoss: 0.80796, map50: 0.39508, valLoss: 1.82042 },
  { epoch: 192, trainLoss: 0.81779, map50: 0.39352, valLoss: 1.82252 },
  { epoch: 193, trainLoss: 0.83972, map50: 0.39452, valLoss: 1.81939 },
  { epoch: 194, trainLoss: 0.82195, map50: 0.3938, valLoss: 1.81406 },
  { epoch: 195, trainLoss: 0.83662, map50: 0.39983, valLoss: 1.82159 },
  { epoch: 196, trainLoss: 0.85826, map50: 0.40121, valLoss: 1.80654 },
  { epoch: 197, trainLoss: 0.84712, map50: 0.39849, valLoss: 1.81447 },
  { epoch: 198, trainLoss: 0.81295, map50: 0.39691, valLoss: 1.81164 },
  { epoch: 199, trainLoss: 0.81063, map50: 0.39542, valLoss: 1.80835 },
  { epoch: 200, trainLoss: 0.812, map50: 0.39669, valLoss: 1.8144 },
];

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
  // See per-class-chart.tsx for why we avoid ResponsiveContainer here.
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
        <LineChart
          width={width}
          height={300}
          data={CURVE_DATA}
          margin={{ top: 8, right: 16, bottom: 24, left: 8 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(240, 5%, 88%)" />

          <XAxis
            dataKey="epoch"
            type="number"
            domain={[0, 200]}
            tickCount={11}
            tick={{ fontSize: 11, fontFamily: "var(--font-mono)", fill: "hsl(220, 8%, 45%)" }}
            axisLine={false}
            tickLine={false}
          >
            <Label
              value="Epoch"
              position="insideBottomRight"
              offset={-4}
              style={{ fontSize: 11, fill: "hsl(220, 8%, 45%)" }}
            />
          </XAxis>

          {/* Left Y-axis: loss */}
          <YAxis
            yAxisId="loss"
            domain={[0.5, 2]}
            tickCount={7}
            tickFormatter={(v: number) => v.toFixed(1)}
            tick={{ fontSize: 11, fontFamily: "var(--font-mono)", fill: "hsl(220, 8%, 45%)" }}
            axisLine={false}
            tickLine={false}
            width={36}
          />

          {/* Right Y-axis: mAP */}
          <YAxis
            yAxisId="map"
            orientation="right"
            domain={[0.2, 0.5]}
            tickCount={7}
            tickFormatter={(v: number) => v.toFixed(2)}
            tick={{ fontSize: 11, fontFamily: "var(--font-mono)", fill: "hsl(220, 8%, 45%)" }}
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

          {/* Best checkpoint reference line at epoch 114 */}
          <ReferenceLine
            yAxisId="loss"
            x={114}
            stroke="hsl(0, 72%, 45%)"
            strokeDasharray="4 3"
            strokeWidth={1.5}
            label={{
              value: "Best ckpt (ep 114)",
              position: "insideTopRight",
              style: { fontSize: 10, fill: "hsl(0, 72%, 45%)", fontFamily: "var(--font-mono)" },
            }}
          />

          <Line
            yAxisId="loss"
            type="monotone"
            dataKey="trainLoss"
            name="Train Loss"
            stroke="hsl(28, 92%, 52%)"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />

          <Line
            yAxisId="loss"
            type="monotone"
            dataKey="valLoss"
            name="Val Loss"
            stroke="hsl(210, 70%, 45%)"
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
            stroke="hsl(142, 60%, 38%)"
            strokeWidth={2.5}
            dot={false}
            activeDot={{ r: 4 }}
          />
        </LineChart>
      </div>
    </div>
  );
}
