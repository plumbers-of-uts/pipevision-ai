/**
 * history-table.tsx — Paginated table of HistoryRecord items.
 * Matches gui-mockup.html data-table with thumbnail, badges, pagination.
 *
 * Pagination: 10 records/page, shows page numbers with ellipsis at extremes.
 * Actions: view detail (Dialog), delete (deleteById).
 */

"use client";

import { ChevronLeft, ChevronRight, Eye, Trash2 } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { deleteById } from "@/features/history-store/repository";
import type { HistoryRecord } from "@/features/history-store/types";
import { formatDateTime } from "@/lib/relative-time";
import { cn } from "@/lib/utils";

type Severity = "critical" | "high" | "medium" | "low";

const SEV_STYLES: Record<Severity | "none", { badge: string; label: string }> = {
  critical: { badge: "bg-[#fde8e8] text-[#d9363e]", label: "Critical" },
  high: { badge: "bg-[#fff0e0] text-[#c05a1a]", label: "High" },
  medium: { badge: "bg-[#fef9e7] text-[#8a6d00]", label: "Medium" },
  low: { badge: "bg-[#e8f8ef] text-[#1a7a3a]", label: "Low" },
  none: { badge: "bg-[#e8f8ef] text-[#1a7a3a]", label: "Pass" },
};

function topSeverity(record: HistoryRecord): Severity | "none" {
  if (record.detections.length === 0) return "none";
  for (const sev of ["critical", "high", "medium", "low"] as Severity[]) {
    if (record.detections.some((d) => d.severity === sev)) return sev;
  }
  return "low";
}

function buildPageNumbers(current: number, total: number): (number | "…")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages: (number | "…")[] = [];
  pages.push(1);
  if (current > 3) pages.push("…");
  for (let p = Math.max(2, current - 1); p <= Math.min(total - 1, current + 1); p++) {
    pages.push(p);
  }
  if (current < total - 2) pages.push("…");
  pages.push(total);
  return pages;
}

interface HistoryTableProps {
  records: HistoryRecord[];
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onDeleted: () => void;
}

export function HistoryTable({
  records,
  total,
  page,
  pageSize,
  onPageChange,
  onDeleted,
}: HistoryTableProps) {
  const [viewRecord, setViewRecord] = useState<HistoryRecord | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const pageNums = buildPageNumbers(page, totalPages);
  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  async function handleDelete(id: string) {
    setDeletingId(id);
    await deleteById(id);
    setDeletingId(null);
    setConfirmDeleteId(null);
    onDeleted();
  }

  return (
    <>
      <div className="overflow-hidden rounded-lg border border-border-default bg-bg-surface">
        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[13px]" aria-label="Inspection history">
            <thead>
              <tr className="border-b border-border-default bg-bg-elevated">
                {[
                  "Date / Time",
                  "Preview",
                  "ID",
                  "Detections",
                  "Severity",
                  "Model",
                  "Inf. Time",
                  "Actions",
                ].map((h) => (
                  <th
                    key={h}
                    scope="col"
                    className="px-3.5 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.5px] text-fg-tertiary"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {records.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-sm text-fg-tertiary">
                    No records match the current filters.
                  </td>
                </tr>
              )}
              {records.map((record) => {
                const sev = topSeverity(record);
                const style = SEV_STYLES[sev];
                const dt = formatDateTime(record.createdAt);
                const topDet = record.detections[0];

                return (
                  <tr
                    key={record.id}
                    className="border-b border-border-default transition-colors last:border-0 hover:bg-bg-elevated"
                  >
                    {/* Date/Time */}
                    <td className="px-3.5 py-3 align-middle">
                      <div className="font-mono text-[12px] text-fg-secondary">{dt.date}</div>
                      <div className="font-mono text-[11px] text-fg-tertiary">{dt.time}</div>
                    </td>

                    {/* Thumbnail */}
                    <td className="px-3.5 py-3 align-middle">
                      <div
                        className="size-[38px] shrink-0 overflow-hidden rounded border border-border-default bg-bg-base"
                        style={{ width: 52 }}
                      >
                        <img
                          src={record.thumbnailDataUrl}
                          alt={topDet?.className ?? "Clean pipe"}
                          className="size-full object-cover"
                          loading="lazy"
                          width={52}
                          height={38}
                        />
                      </div>
                    </td>

                    {/* ID */}
                    <td className="px-3.5 py-3 align-middle">
                      <span className="font-mono text-[12px] text-fg-primary" title={record.id}>
                        {record.id.slice(0, 8).toUpperCase()}
                      </span>
                    </td>

                    {/* Detections */}
                    <td className="px-3.5 py-3 align-middle">
                      {record.detections.length === 0 ? (
                        <span className="text-[11px] text-success">None</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {record.detections.slice(0, 4).map((det, i) => (
                            <span
                              // biome-ignore lint/suspicious/noArrayIndexKey: stable
                              key={`${det.id}-${i}`}
                              className="rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold"
                              style={{
                                background: `color-mix(in srgb, ${det.color} 15%, transparent)`,
                                color: det.color,
                              }}
                            >
                              {det.className.slice(0, 4).toUpperCase()}
                            </span>
                          ))}
                          {record.detections.length > 4 && (
                            <span className="text-[10px] text-fg-tertiary">
                              +{record.detections.length - 4}
                            </span>
                          )}
                        </div>
                      )}
                    </td>

                    {/* Severity */}
                    <td className="px-3.5 py-3 align-middle">
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.3px]",
                          style.badge,
                        )}
                      >
                        {style.label}
                      </span>
                    </td>

                    {/* Model version */}
                    <td className="px-3.5 py-3 align-middle">
                      <span className="rounded border border-border-default bg-bg-elevated px-1.5 py-0.5 font-mono text-[10px] text-fg-secondary">
                        {record.modelVersion}
                      </span>
                    </td>

                    {/* Inference time */}
                    <td className="px-3.5 py-3 align-middle">
                      <span className="font-mono text-[12px] text-fg-secondary">
                        {(record.inferenceMs / 1000).toFixed(2)}s
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="px-3.5 py-3 align-middle">
                      <div className="flex gap-1.5">
                        <button
                          type="button"
                          onClick={() => setViewRecord(record)}
                          aria-label={`View details for record ${record.id.slice(0, 8)}`}
                          className="flex size-7 items-center justify-center rounded border border-border-default bg-bg-elevated text-fg-secondary transition-colors hover:border-accent hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
                        >
                          <Eye className="size-3.5" aria-hidden={true} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(record.id)}
                          disabled={deletingId === record.id}
                          aria-label={`Delete record ${record.id.slice(0, 8)}`}
                          className="flex size-7 items-center justify-center rounded border border-border-default bg-bg-elevated text-error transition-colors hover:border-error hover:bg-[#fde8e8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus disabled:opacity-40"
                        >
                          <Trash2 className="size-3.5" aria-hidden={true} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between border-t border-border-default px-4 py-3.5">
          <div className="text-[12px] text-fg-tertiary">
            {total === 0 ? "No results" : `Showing ${start}–${end} of ${total} results`}
          </div>
          <nav className="flex items-center gap-1" aria-label="Pagination">
            {/* Prev */}
            <button
              type="button"
              onClick={() => onPageChange(page - 1)}
              disabled={page === 1}
              aria-label="Previous page"
              className="flex size-7 items-center justify-center rounded border border-border-default bg-bg-elevated text-fg-secondary transition-colors hover:border-accent hover:text-accent disabled:opacity-40"
            >
              <ChevronLeft className="size-3.5" aria-hidden={true} />
            </button>

            {pageNums.map((p, i) =>
              p === "…" ? (
                // biome-ignore lint/suspicious/noArrayIndexKey: ellipsis spacer
                <span
                  key={`ellipsis-${i}`}
                  className="flex size-7 items-center justify-center text-[12px] text-fg-tertiary"
                >
                  …
                </span>
              ) : (
                <button
                  // biome-ignore lint/suspicious/noArrayIndexKey: page buttons are stable
                  key={`page-${p}-${i}`}
                  type="button"
                  onClick={() => onPageChange(p as number)}
                  aria-label={`Page ${p}`}
                  aria-current={p === page ? "page" : undefined}
                  className={cn(
                    "flex size-7 items-center justify-center rounded border font-mono text-[12px] transition-colors",
                    p === page
                      ? "border-accent bg-accent font-bold text-white"
                      : "border-border-default bg-bg-elevated text-fg-secondary hover:border-accent hover:text-accent",
                  )}
                >
                  {p}
                </button>
              ),
            )}

            {/* Next */}
            <button
              type="button"
              onClick={() => onPageChange(page + 1)}
              disabled={page === totalPages}
              aria-label="Next page"
              className="flex size-7 items-center justify-center rounded border border-border-default bg-bg-elevated text-fg-secondary transition-colors hover:border-accent hover:text-accent disabled:opacity-40"
            >
              <ChevronRight className="size-3.5" aria-hidden={true} />
            </button>
          </nav>
        </div>
      </div>

      {/* View Detail Dialog */}
      {viewRecord && (
        <Dialog
          open
          onOpenChange={(open) => {
            if (!open) setViewRecord(null);
          }}
        >
          <DialogContent className="max-w-lg bg-bg-surface">
            <DialogHeader>
              <DialogTitle>Inspection Detail</DialogTitle>
              <DialogDescription>
                Record ID: <span className="font-mono">{viewRecord.id}</span>
              </DialogDescription>
            </DialogHeader>

            <div className="flex gap-4">
              <img
                src={viewRecord.thumbnailDataUrl}
                alt="Inspection thumbnail"
                className="size-24 rounded object-cover"
              />
              <div className="flex flex-col gap-1.5 text-sm">
                <div>
                  <span className="text-fg-tertiary">Date:</span>{" "}
                  {formatDateTime(viewRecord.createdAt).date}{" "}
                  {formatDateTime(viewRecord.createdAt).time}
                </div>
                <div>
                  <span className="text-fg-tertiary">Model:</span>{" "}
                  <span className="font-mono">{viewRecord.modelVersion}</span>
                </div>
                <div>
                  <span className="text-fg-tertiary">Inference:</span>{" "}
                  {(viewRecord.inferenceMs / 1000).toFixed(2)}s
                </div>
                <div>
                  <span className="text-fg-tertiary">Detections:</span>{" "}
                  {viewRecord.detections.length}
                </div>
              </div>
            </div>

            {viewRecord.detections.length > 0 && (
              <div className="mt-2">
                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-fg-tertiary">
                  Detections
                </div>
                <div className="flex flex-col gap-1.5">
                  {viewRecord.detections.map((det, i) => (
                    // biome-ignore lint/suspicious/noArrayIndexKey: stable
                    <div
                      key={`${det.id}-${i}`}
                      className="flex items-center justify-between rounded border border-border-default bg-bg-elevated px-3 py-2 text-sm"
                    >
                      <span className="font-medium text-fg-primary">{det.className}</span>
                      <span className="font-mono text-fg-secondary">
                        {(det.confidence * 100).toFixed(1)}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <DialogFooter showCloseButton>{null}</DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Confirm Delete Dialog */}
      {confirmDeleteId && (
        <Dialog
          open
          onOpenChange={(open) => {
            if (!open) setConfirmDeleteId(null);
          }}
        >
          <DialogContent className="max-w-sm bg-bg-surface">
            <DialogHeader>
              <DialogTitle>Delete Record</DialogTitle>
              <DialogDescription>
                This will permanently remove the inspection record. This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setConfirmDeleteId(null)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => handleDelete(confirmDeleteId)}
                disabled={deletingId === confirmDeleteId}
              >
                {deletingId === confirmDeleteId ? "Deleting…" : "Delete"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
