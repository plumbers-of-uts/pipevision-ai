/**
 * csv-exporter.ts — Exports HistoryRecord list to CSV.
 *
 * Excluded fields (binary): imageBlob, thumbnailDataUrl.
 * Detections are flattened to a semicolon-separated class name list.
 *
 * Contract C4 compliant column order.
 */

import type { HistoryRecord } from "@/features/history-store/types";

function escapeCsv(value: string | number): string {
  const s = String(value);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/**
 * exportToCsv — downloads a CSV file of the provided records.
 *
 * @param records List of HistoryRecord items (usually the current filtered page).
 * @param filename Optional filename (default: "pipevision-history.csv").
 */
export function exportToCsv(records: HistoryRecord[], filename = "pipevision-history.csv"): void {
  const headers = [
    "id",
    "createdAt",
    "modelVersion",
    "inferenceMs",
    "detectionCount",
    "topClass",
    "topConfidence",
    "topSeverity",
    "allClasses",
    "notes",
  ];

  const rows = records.map((r) => {
    const topDet = r.detections[0];
    const allClasses = r.detections.map((d) => d.className).join(";");
    return [
      r.id,
      new Date(r.createdAt).toISOString(),
      r.modelVersion,
      r.inferenceMs,
      r.detections.length,
      topDet?.className ?? "",
      topDet !== undefined ? topDet.confidence.toFixed(2) : "",
      topDet?.severity ?? "",
      allClasses,
      r.notes ?? "",
    ].map(escapeCsv);
  });

  const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
