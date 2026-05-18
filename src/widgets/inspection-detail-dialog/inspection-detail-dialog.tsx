/**
 * inspection-detail-dialog.tsx — Shared "Inspection Detail" modal used by
 * both the history table and the dashboard's Recent Detections grid.
 *
 * Stateless: the parent controls open state via `record` (open when non-null)
 * and dismissal via `onOpenChange(false)`.
 */

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { HistoryRecord } from "@/features/history-store/types";
import { formatDateTime } from "@/lib/relative-time";

interface InspectionDetailDialogProps {
  record: HistoryRecord | null;
  onOpenChange: (open: boolean) => void;
}

export function InspectionDetailDialog({ record, onOpenChange }: InspectionDetailDialogProps) {
  if (!record) return null;

  const dt = formatDateTime(record.createdAt);

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg bg-bg-surface">
        <DialogHeader>
          <DialogTitle>Inspection Detail</DialogTitle>
          <DialogDescription>
            Record ID: <span className="font-mono">{record.id}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-4">
          <img
            src={record.thumbnailDataUrl}
            alt="Inspection thumbnail"
            className="size-24 rounded object-cover"
          />
          <div className="flex flex-col gap-1.5 text-sm">
            <div>
              <span className="text-fg-tertiary">Date:</span> {dt.date} {dt.time}
            </div>
            <div>
              <span className="text-fg-tertiary">Model:</span>{" "}
              <span className="font-mono">{record.modelVersion}</span>
            </div>
            <div>
              <span className="text-fg-tertiary">Inference:</span>{" "}
              {(record.inferenceMs / 1000).toFixed(2)}s
            </div>
            <div>
              <span className="text-fg-tertiary">Detections:</span> {record.detections.length}
            </div>
          </div>
        </div>

        {record.detections.length > 0 && (
          <div className="mt-2">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-fg-tertiary">
              Detections
            </div>
            <div className="flex flex-col gap-1.5">
              {record.detections.map((det) => (
                <div
                  key={det.id}
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
  );
}
