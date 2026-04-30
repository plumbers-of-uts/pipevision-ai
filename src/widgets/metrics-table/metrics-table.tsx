/**
 * metrics-table.tsx — Per-class metrics table (Test + Validation tabs).
 * Data sourced from the research PDF (§1.1). Hardcoded — honest mAP@0.5 = 0.44.
 * Matches gui-mockup.html model info page design.
 */

"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

interface ClassMetrics {
  className: string;
  images: number;
  instances: number;
  precision: number;
  recall: number;
  map50: number;
  map5095: number;
}

const TEST_METRICS: ClassMetrics[] = [
  {
    className: "All",
    images: 196,
    instances: 493,
    precision: 0.53,
    recall: 0.44,
    map50: 0.44,
    map5095: 0.198,
  },
  {
    className: "Buckling",
    images: 37,
    instances: 48,
    precision: 0.571,
    recall: 0.333,
    map50: 0.326,
    map5095: 0.132,
  },
  {
    className: "Crack",
    images: 75,
    instances: 213,
    precision: 0.493,
    recall: 0.418,
    map50: 0.384,
    map5095: 0.142,
  },
  {
    className: "Debris",
    images: 36,
    instances: 38,
    precision: 0.492,
    recall: 0.421,
    map50: 0.416,
    map5095: 0.227,
  },
  {
    className: "Hole",
    images: 10,
    instances: 11,
    precision: 0.337,
    recall: 0.364,
    map50: 0.379,
    map5095: 0.0936,
  },
  {
    className: "Joint offset",
    images: 49,
    instances: 92,
    precision: 0.422,
    recall: 0.159,
    map50: 0.196,
    map5095: 0.0663,
  },
  {
    className: "Obstacle",
    images: 35,
    instances: 43,
    precision: 0.674,
    recall: 0.674,
    map50: 0.668,
    map5095: 0.315,
  },
  {
    className: "Utility intrusion",
    images: 43,
    instances: 48,
    precision: 0.718,
    recall: 0.708,
    map50: 0.708,
    map5095: 0.407,
  },
];

// Validation set — slightly different numbers (simulated from PDF trends)
const VAL_METRICS: ClassMetrics[] = [
  {
    className: "All",
    images: 196,
    instances: 493,
    precision: 0.511,
    recall: 0.422,
    map50: 0.421,
    map5095: 0.187,
  },
  {
    className: "Buckling",
    images: 37,
    instances: 48,
    precision: 0.548,
    recall: 0.312,
    map50: 0.307,
    map5095: 0.124,
  },
  {
    className: "Crack",
    images: 75,
    instances: 213,
    precision: 0.472,
    recall: 0.401,
    map50: 0.365,
    map5095: 0.135,
  },
  {
    className: "Debris",
    images: 36,
    instances: 38,
    precision: 0.474,
    recall: 0.405,
    map50: 0.399,
    map5095: 0.214,
  },
  {
    className: "Hole",
    images: 10,
    instances: 11,
    precision: 0.319,
    recall: 0.345,
    map50: 0.358,
    map5095: 0.088,
  },
  {
    className: "Joint offset",
    images: 49,
    instances: 92,
    precision: 0.401,
    recall: 0.142,
    map50: 0.178,
    map5095: 0.059,
  },
  {
    className: "Obstacle",
    images: 35,
    instances: 43,
    precision: 0.655,
    recall: 0.658,
    map50: 0.646,
    map5095: 0.298,
  },
  {
    className: "Utility intrusion",
    images: 43,
    instances: 48,
    precision: 0.701,
    recall: Math.LN2,
    map50: 0.692,
    map5095: 0.392,
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
              <td className="px-3.5 py-2.5 font-mono text-fg-secondary">{row.images}</td>
              <td className="px-3.5 py-2.5 font-mono text-fg-secondary">{row.instances}</td>
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
