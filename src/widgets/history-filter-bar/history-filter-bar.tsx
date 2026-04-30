/**
 * history-filter-bar.tsx — Filter controls for the History page.
 * Controlled component; lifts all filter state to parent via onChange.
 *
 * Limitations:
 *   - Text search (notes/ID) is client-side only on the current visible page.
 *     Full-text search across all records would require a separate IDB index.
 *     This is documented here as a known limitation for sprint 3 to address.
 *   - Class filter is single-select (UI). Multi-select requires a custom combobox.
 */

"use client";

import { Filter, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { PIPEVISION_CLASSES } from "@/features/history-store/classes";
import type { Severity } from "@/features/history-store/types";

export interface HistoryFilters {
  search: string;
  from: string; // ISO date string "YYYY-MM-DD"
  to: string;
  classFilter: number | ""; // "" = all
  severityFilter: Severity | "";
}

interface HistoryFilterBarProps {
  filters: HistoryFilters;
  onChange: (next: HistoryFilters) => void;
  onExportCsv: () => void;
  onResetDemo: () => void;
}

const SEVERITIES: Array<{ value: Severity; label: string }> = [
  { value: "critical", label: "Critical" },
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
];

export function HistoryFilterBar({
  filters,
  onChange,
  onExportCsv,
  onResetDemo,
}: HistoryFilterBarProps) {
  function set<K extends keyof HistoryFilters>(key: K, value: HistoryFilters[K]) {
    onChange({ ...filters, [key]: value });
  }

  const inputClass =
    "rounded border border-border-hover bg-bg-base px-3 py-1.5 text-[13px] text-fg-primary placeholder:text-fg-tertiary outline-none focus:border-border-focus transition-colors";

  return (
    <div
      className="mb-4 flex flex-wrap items-center gap-2.5 rounded-lg border border-border-default bg-bg-surface px-4 py-3.5"
      role="search"
      aria-label="History filter controls"
    >
      {/* Search */}
      <input
        type="search"
        placeholder="Search ID or notes…"
        aria-label="Search inspection ID or notes"
        className={inputClass}
        style={{ width: 200 }}
        value={filters.search}
        onChange={(e) => set("search", e.target.value)}
      />

      {/* Date range */}
      <input
        type="date"
        aria-label="From date"
        className={inputClass}
        style={{ width: 148 }}
        value={filters.from}
        max={filters.to || undefined}
        onChange={(e) => set("from", e.target.value)}
      />
      <span className="text-[12px] text-fg-tertiary" aria-hidden="true">
        to
      </span>
      <input
        type="date"
        aria-label="To date"
        className={inputClass}
        style={{ width: 148 }}
        value={filters.to}
        min={filters.from || undefined}
        onChange={(e) => set("to", e.target.value)}
      />

      {/* Class filter */}
      <select
        aria-label="Filter by defect class"
        className={`${inputClass} cursor-pointer`}
        style={{ width: 160 }}
        value={String(filters.classFilter)}
        onChange={(e) => set("classFilter", e.target.value === "" ? "" : Number(e.target.value))}
      >
        <option value="">All Defect Types</option>
        {PIPEVISION_CLASSES.map((cls) => (
          <option key={cls.id} value={cls.id}>
            {cls.name}
          </option>
        ))}
      </select>

      {/* Severity filter */}
      <select
        aria-label="Filter by severity"
        className={`${inputClass} cursor-pointer`}
        style={{ width: 140 }}
        value={filters.severityFilter}
        onChange={(e) => set("severityFilter", e.target.value as Severity | "")}
      >
        <option value="">All Severity</option>
        {SEVERITIES.map((s) => (
          <option key={s.value} value={s.value}>
            {s.label}
          </option>
        ))}
      </select>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Actions */}
      <Button
        size="sm"
        variant="outline"
        onClick={onExportCsv}
        aria-label="Export filtered history as CSV"
      >
        Export CSV
      </Button>

      <Button
        size="sm"
        variant="ghost"
        onClick={onResetDemo}
        aria-label="Reset demo data"
        className="gap-1.5 text-fg-secondary hover:text-error"
      >
        <RefreshCw className="size-3.5" aria-hidden={true} />
        Reset Demo
      </Button>

      {/* Apply button (triggers re-fetch via parent state update) */}
      <Button
        size="sm"
        onClick={() => onChange({ ...filters })}
        aria-label="Apply filters"
        className="gap-1.5"
      >
        <Filter className="size-3.5" aria-hidden={true} />
        Apply
      </Button>
    </div>
  );
}
