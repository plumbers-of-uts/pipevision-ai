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
      <DialogContent className="flex max-h-[90vh] max-w-3xl flex-col gap-4 overflow-y-auto bg-bg-surface">
        <DialogHeader>
          <DialogTitle>Inspection Detail</DialogTitle>
          <DialogDescription>
            Record ID: <span className="font-mono">{record.id}</span>
          </DialogDescription>
        </DialogHeader>

        {/* Annotated image — main subject of the dialog */}
        <div className="flex items-center justify-center overflow-hidden rounded border border-border-default bg-bg-base">
          <img
            src={record.thumbnailDataUrl}
            alt="Annotated inspection with detection overlays"
            className="block max-h-[60vh] w-full object-contain"
          />
        </div>

        {/* Inline metadata strip */}
        <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm sm:grid-cols-4">
          <div>
            <div className="text-[11px] uppercase tracking-wide text-fg-tertiary">Date</div>
            <div className="font-mono text-fg-primary">{dt.date}</div>
            <div className="font-mono text-[11px] text-fg-tertiary">{dt.time}</div>
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-wide text-fg-tertiary">Model</div>
            <div className="truncate font-mono text-fg-primary" title={record.modelVersion}>
              {record.modelVersion}
            </div>
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-wide text-fg-tertiary">Inference</div>
            <div className="font-mono text-fg-primary">
              {(record.inferenceMs / 1000).toFixed(2)}s
            </div>
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-wide text-fg-tertiary">Detections</div>
            <div className="font-mono text-fg-primary">{record.detections.length}</div>
          </div>
        </div>

        {record.detections.length > 0 && (
          <div>
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
