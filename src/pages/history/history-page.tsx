/**
 * history-page.tsx — Inspection History page.
 *
 * Assembles:
 *   - HistoryFilterBar (search, date range, class/severity select, Export CSV, Reset Demo)
 *   - HistoryTable (paginated table with thumbnail, badges, delete/view actions)
 *
 * Pagination: 10 records/page. Filters applied via list() from repository.
 * "Export CSV" downloads current filtered result set (all pages).
 * "Reset Demo" confirms with Dialog then calls reseedDemo().
 *
 * Matches gui-mockup.html #page-history (lines 1177-1324).
 */

import { useBoolean, useRequest } from "ahooks";
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
import { exportToCsv } from "@/features/export/csv-exporter";
import { list } from "@/features/history-store/repository";
import { reseedDemo } from "@/features/history-store/seed";
import type { Severity } from "@/features/history-store/types";
import { HistoryFilterBar } from "@/widgets/history-filter-bar";
import type { HistoryFilters } from "@/widgets/history-filter-bar";
import { HistoryTable } from "@/widgets/history-table";

const PAGE_SIZE = 10;

function defaultFilters(): HistoryFilters {
  return {
    search: "",
    from: "",
    to: "",
    classFilter: "",
    severityFilter: "",
  };
}

export function HistoryPage() {
  const [filters, setFilters] = useState<HistoryFilters>(defaultFilters);
  const [page, setPage] = useState(1);
  const [resetDialogOpen, { setTrue: openResetDialog, setFalse: closeResetDialog }] =
    useBoolean(false);
  const [resetting, { setTrue: startReset, setFalse: endReset }] = useBoolean(false);

  // useRequest re-runs whenever filters or page change. refresh() forces a re-fetch.
  const {
    data,
    loading,
    refresh: refreshRecords,
  } = useRequest(
    async () => {
      const fromMs = filters.from ? new Date(filters.from).getTime() : undefined;
      const toMs = filters.to ? new Date(`${filters.to}T23:59:59`).getTime() : undefined;
      const classFilter = filters.classFilter !== "" ? [Number(filters.classFilter)] : undefined;
      const severityFilter =
        filters.severityFilter !== "" ? [filters.severityFilter as Severity] : undefined;

      const { items, total: t } = await list({
        page,
        pageSize: PAGE_SIZE,
        classFilter,
        severityFilter,
        from: fromMs,
        to: toMs,
      });
      // Client-side text search on visible page only (known limitation: not full-text across all pages)
      const searched = filters.search.trim()
        ? items.filter(
            (r) =>
              r.id.toLowerCase().includes(filters.search.toLowerCase()) ||
              (r.notes ?? "").toLowerCase().includes(filters.search.toLowerCase()),
          )
        : items;
      return { items: searched, total: t };
    },
    { refreshDeps: [filters, page] },
  );

  const records = data?.items ?? [];
  const total = data?.total ?? 0;

  function handleFilterChange(next: HistoryFilters) {
    setFilters(next);
    setPage(1); // reset to first page on filter change
  }

  function handlePageChange(p: number) {
    setPage(p);
  }

  function handleDeleted() {
    refreshRecords();
  }

  async function handleExportCsv() {
    // Export ALL matching records (not just current page) by fetching without pagination
    const fromMs = filters.from ? new Date(filters.from).getTime() : undefined;
    const toMs = filters.to ? new Date(`${filters.to}T23:59:59`).getTime() : undefined;
    const classFilter = filters.classFilter !== "" ? [Number(filters.classFilter)] : undefined;
    const severityFilter =
      filters.severityFilter !== "" ? [filters.severityFilter as Severity] : undefined;

    const { items } = await list({
      page: 1,
      pageSize: 10000,
      classFilter,
      severityFilter,
      from: fromMs,
      to: toMs,
    });
    exportToCsv(items);
  }

  async function handleResetDemo() {
    startReset();
    await reseedDemo();
    endReset();
    closeResetDialog();
    setFilters(defaultFilters());
    setPage(1);
    refreshRecords();
  }

  return (
    <main id="main-content" className="overflow-y-auto p-6">
      {/* Page header */}
      <div className="mb-5">
        <h1 className="text-xl font-bold text-fg-primary">Inspection History</h1>
        <p className="mt-0.5 text-[13px] text-fg-tertiary">
          Browse, filter and export past detection results
        </p>
      </div>

      {/* Filter bar */}
      <HistoryFilterBar
        filters={filters}
        onChange={handleFilterChange}
        onExportCsv={handleExportCsv}
        onResetDemo={openResetDialog}
      />

      {/* Table (loading skeleton or data) */}
      {loading ? (
        <div
          className="space-y-2 rounded-lg border border-border-default bg-bg-surface p-4"
          aria-busy="true"
          aria-label="Loading history"
        >
          {Array.from({ length: PAGE_SIZE }).map((_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: skeleton
            <div key={i} className="h-10 animate-pulse rounded bg-bg-elevated" />
          ))}
        </div>
      ) : (
        <HistoryTable
          records={records}
          total={total}
          page={page}
          pageSize={PAGE_SIZE}
          onPageChange={handlePageChange}
          onDeleted={handleDeleted}
        />
      )}

      {/* Reset demo confirmation dialog */}
      <Dialog
        open={resetDialogOpen}
        onOpenChange={(open) => {
          if (!open) closeResetDialog();
        }}
      >
        <DialogContent className="max-w-sm bg-bg-surface">
          <DialogHeader>
            <DialogTitle>Reset Demo Data</DialogTitle>
            <DialogDescription>
              This will permanently delete all current records and re-seed 50 fresh demo
              inspections. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={closeResetDialog} disabled={resetting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleResetDemo} disabled={resetting}>
              {resetting ? "Resetting…" : "Reset Demo Data"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
