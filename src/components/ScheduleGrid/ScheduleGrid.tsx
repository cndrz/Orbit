/**
 * components/ScheduleGrid/ScheduleGrid.tsx
 *
 * Column 2: Spreadsheet-style grid of branch delivery schedules.
 * Supports inline status updates and CSV import.
 */

import { useRef } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Truck,
  CheckCircle,
  Clock,
  XCircle,
  RefreshCw,
  Upload,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import { useSchedules } from "../../hooks/useSqlite";
import { ingestCsvFile } from "../../lib/csvIngestion";
import type { DeliveryStatus, BranchSchedule } from "../../types";

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<
  DeliveryStatus,
  { label: string; icon: LucideIcon; className: string }
> = {
  pending: {
    label: "Pending",
    icon: Clock,
    className: "text-amber-400 bg-amber-400/10 border-amber-400/20",
  },
  in_transit: {
    label: "In Transit",
    icon: Truck,
    className: "text-blue-400  bg-blue-400/10  border-blue-400/20",
  },
  delivered: {
    label: "Delivered",
    icon: CheckCircle,
    className: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20",
  },
  cancelled: {
    label: "Cancelled",
    icon: XCircle,
    className: "text-red-400   bg-red-400/10   border-red-400/20",
  },
};

function StatusBadge({
  status,
  onChange,
}: {
  status: DeliveryStatus;
  onChange: (s: DeliveryStatus) => void;
}) {
  const cfg = STATUS_CONFIG[status];

  return (
    <select
      value={status}
      onChange={(e) => onChange(e.target.value as DeliveryStatus)}
      className={`orbit-tag border cursor-pointer font-mono text-[10px] pr-0 appearance-none
                  ${cfg.className} hover:brightness-125 transition-all`}
      style={{ paddingRight: "6px" }}
    >
      {(Object.keys(STATUS_CONFIG) as DeliveryStatus[]).map((s) => (
        <option key={s} value={s} className="bg-orbit-surface text-orbit-text">
          {STATUS_CONFIG[s].label}
        </option>
      ))}
    </select>
  );
}

// ─── Table row ────────────────────────────────────────────────────────────────

function ScheduleRow({
  row,
  index,
  onStatusChange,
}: {
  row: BranchSchedule;
  index: number;
  onStatusChange: (id: number, status: DeliveryStatus) => void;
}) {
  const ts = new Date(row.delivery_timestamp);
  const dateStr = ts.toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
  });
  const timeStr = ts.toLocaleTimeString("en-PH", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <tr
      className={`border-b border-orbit-border/50 hover:bg-orbit-border/20 transition-colors
                  ${index % 2 === 0 ? "" : "bg-orbit-surface/30"}`}
    >
      <td className="px-3 py-2 text-orbit-subtext font-mono text-[10px]">
        {row.id}
      </td>
      <td className="px-3 py-2">
        <div className="text-orbit-text text-xs font-medium">
          {row.branch_name}
        </div>
        <div className="text-orbit-subtext text-[10px]">
          {row.location_region}
        </div>
      </td>
      <td className="px-3 py-2">
        <div className="text-orbit-text text-xs">{dateStr}</div>
        <div className="text-orbit-subtext font-mono text-[10px]">
          {timeStr}
        </div>
      </td>
      <td className="px-3 py-2 max-w-[140px]">
        <span className="text-orbit-text text-xs line-clamp-2">
          {row.cargo_details}
        </span>
      </td>
      <td className="px-3 py-2">
        <StatusBadge
          status={row.status}
          onChange={(s) => onStatusChange(row.id, s)}
        />
      </td>
    </tr>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ScheduleGrid() {
  const { schedules, loading, error, refresh, updateStatus } = useSchedules();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleCsvImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const result = await ingestCsvFile(file);
      console.log(`[CSV] Imported ${result.inserted} rows`, result.errors);
      await refresh();
    } catch (err) {
      console.error("[CSV] Import failed:", err);
    }
    e.target.value = "";
  };

  const statusCounts = schedules.reduce(
    (acc, s) => ({ ...acc, [s.status]: (acc[s.status] ?? 0) + 1 }),
    {} as Record<string, number>,
  );

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-orbit-border flex-shrink-0">
        <div>
          <h2 className="font-display font-bold text-sm tracking-wide text-orbit-text">
            Branch Schedules
          </h2>
          <div className="flex items-center gap-3 mt-0.5">
            {Object.entries(statusCounts).map(([status, count]) => {
              const cfg = STATUS_CONFIG[status as DeliveryStatus];
              if (!cfg) return null;
              return (
                <span
                  key={status}
                  className={`text-[10px] ${cfg.className.split(" ")[0]}`}
                >
                  {count} {cfg.label.toLowerCase()}
                </span>
              );
            })}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={refresh}
            className="orbit-btn-ghost p-1.5"
            title="Refresh"
          >
            <RefreshCw size={13} />
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="orbit-btn-ghost text-xs gap-1.5"
            title="Import CSV"
          >
            <Upload size={13} />
            Import CSV
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={handleCsvImport}
          />
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center h-full text-orbit-subtext gap-2">
            <Loader2 size={14} className="animate-spin" />
            <span className="text-xs">Loading schedules…</span>
          </div>
        ) : error ? (
          <div className="flex items-center gap-2 text-orbit-danger text-xs p-4">
            <AlertTriangle size={14} />
            {error}
          </div>
        ) : (
          <table className="w-full border-collapse text-left">
            <thead className="sticky top-0 z-10">
              <tr className="bg-orbit-surface border-b border-orbit-border">
                {["#", "Branch", "Delivery", "Cargo", "Status"].map((col) => (
                  <th
                    key={col}
                    className="px-3 py-2 text-[10px] font-mono uppercase tracking-widest
                               text-orbit-muted font-medium"
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {schedules.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="text-center py-12 text-orbit-subtext text-xs"
                  >
                    No schedules found. Import a CSV to get started.
                  </td>
                </tr>
              ) : (
                schedules.map((row, i) => (
                  <ScheduleRow
                    key={row.id}
                    row={row}
                    index={i}
                    onStatusChange={updateStatus}
                  />
                ))
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Footer stats */}
      <div className="px-4 py-2 border-t border-orbit-border flex-shrink-0 flex items-center justify-between">
        <span className="text-[10px] text-orbit-muted font-mono">
          {schedules.length} rows
        </span>
        <span className="text-[10px] text-orbit-muted">
          Click status badge to update inline
        </span>
      </div>
    </div>
  );
}
