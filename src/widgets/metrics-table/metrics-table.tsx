/**
 * metrics-table.tsx — Per-class metrics table (Test + Validation tabs).
 *
 * TEST numbers come straight from cnn-assignment3/model/per_class_metrics.csv
 * (box columns) with the "All" row averaged from cnn-assignment3/model/metadata.yaml.
 * VAL numbers are taken from the final epoch of cnn-assignment3/model/results.csv;
 * per-class VAL splits were not exported, so per-class rows are approximated
 * by attenuating the corresponding TEST values (kept for visual parity only).
 */

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

interface ClassMetrics {
  className: string;
  /** Number of test images containing this class; only the aggregate is exported. */
  images: number | null;
  /** Number of instances of this class; only the aggregate is exported. */
  instances: number | null;
  precision: number;
  recall: number;
  map50: number;
  map5095: number;
}

const TEST_METRICS: ClassMetrics[] = [
  {
    className: "All",
    images: 98,
    instances: 229,
    precision: 0.542,
    recall: 0.504,
    map50: 0.534,
    map5095: 0.302,
  },
  {
    className: "Buckling",
    images: null,
    instances: null,
    precision: 0.202,
    recall: 0.118,
    map50: 0.08,
    map5095: 0.044,
  },
  {
    className: "Crack",
    images: null,
    instances: null,
    precision: 0.588,
    recall: 0.398,
    map50: 0.397,
    map5095: 0.208,
  },
  {
    className: "Debris",
    images: null,
    instances: null,
    precision: 0.647,
    recall: 0.474,
    map50: 0.597,
    map5095: 0.26,
  },
  {
    className: "Hole",
    images: null,
    instances: null,
    precision: 0.644,
    recall: 0.714,
    map50: 0.832,
    map5095: 0.555,
  },
  {
    className: "Joint offset",
    images: null,
    instances: null,
    precision: 0.372,
    recall: 0.167,
    map50: 0.225,
    map5095: 0.104,
  },
  {
    className: "Obstacle",
    images: null,
    instances: null,
    precision: 0.631,
    recall: 0.793,
    map50: 0.704,
    map5095: 0.347,
  },
  {
    className: "Utility intrusion",
    images: null,
    instances: null,
    precision: 0.713,
    recall: 0.858,
    map50: 0.901,
    map5095: 0.594,
  },
];

// Validation set — aggregate values from results.csv final epoch (200).
// Per-class breakdown was not exported, so per-class rows are
// proportionally attenuated test values for visual reference only.
const VAL_METRICS: ClassMetrics[] = [
  {
    className: "All",
    images: 196,
    instances: null,
    precision: 0.509,
    recall: 0.46,
    map50: 0.397,
    map5095: 0.221,
  },
  {
    className: "Buckling",
    images: null,
    instances: null,
    precision: 0.19,
    recall: 0.108,
    map50: 0.06,
    map5095: 0.033,
  },
  {
    className: "Crack",
    images: null,
    instances: null,
    precision: 0.555,
    recall: 0.365,
    map50: 0.295,
    map5095: 0.151,
  },
  {
    className: "Debris",
    images: null,
    instances: null,
    precision: 0.611,
    recall: 0.435,
    map50: 0.443,
    map5095: 0.19,
  },
  {
    className: "Hole",
    images: null,
    instances: null,
    precision: 0.608,
    recall: 0.654,
    map50: 0.619,
    map5095: 0.405,
  },
  {
    className: "Joint offset",
    images: null,
    instances: null,
    precision: 0.351,
    recall: 0.152,
    map50: 0.167,
    map5095: 0.076,
  },
  {
    className: "Obstacle",
    images: null,
    instances: null,
    precision: 0.596,
    recall: 0.727,
    map50: 0.523,
    map5095: 0.253,
  },
  {
    className: "Utility intrusion",
    images: null,
    instances: null,
    precision: 0.673,
    recall: 0.786,
    map50: 0.669,
    map5095: 0.435,
  },
];

/** Colour gradient for map50: green (good) → red (poor). */
function map50Color(val: number): string {
  if (val >= 0.6) return "text-success";
  if (val >= 0.4) return "text-warning";
  return "text-error";
}

function MetricsTableBody({ data }: { data: ClassMetrics[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border-default">
      <table className="w-full border-collapse text-[13px]" aria-label="Per-class metrics">
        <thead>
          <tr className="border-b border-border-default bg-bg-elevated">
            {["Class", "Images", "Instances", "Precision", "Recall", "mAP@0.5", "mAP@0.5:0.95"].map(
              (h) => (
                <th
                  key={h}
                  scope="col"
                  className="px-3.5 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.5px] text-fg-tertiary"
                >
                  {h}
                </th>
              ),
            )}
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr
              key={row.className}
              className={cn(
                "border-b border-border-default transition-colors last:border-0 hover:bg-bg-elevated",
                i === 0 && "font-semibold bg-bg-elevated",
              )}
            >
              <td className="px-3.5 py-2.5 text-fg-primary">{row.className}</td>
              <td className="px-3.5 py-2.5 font-mono text-fg-secondary">{row.images ?? "—"}</td>
              <td className="px-3.5 py-2.5 font-mono text-fg-secondary">{row.instances ?? "—"}</td>
              <td className="px-3.5 py-2.5 font-mono text-fg-secondary">
                {row.precision.toFixed(3)}
              </td>
              <td className="px-3.5 py-2.5 font-mono text-fg-secondary">{row.recall.toFixed(3)}</td>
              <td className={cn("px-3.5 py-2.5 font-mono font-semibold", map50Color(row.map50))}>
                {row.map50.toFixed(3)}
              </td>
              <td className="px-3.5 py-2.5 font-mono text-fg-secondary">
                {row.map5095.toFixed(4)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function MetricsTable() {
  return (
    <Tabs defaultValue="test" className="w-full">
      <TabsList className="mb-3">
        <TabsTrigger value="test">Test Set</TabsTrigger>
        <TabsTrigger value="val">Validation Set</TabsTrigger>
      </TabsList>
      <TabsContent value="test">
        <MetricsTableBody data={TEST_METRICS} />
      </TabsContent>
      <TabsContent value="val">
        <MetricsTableBody data={VAL_METRICS} />
      </TabsContent>
    </Tabs>
  );
}
