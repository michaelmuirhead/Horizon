"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import type { PlannerEntry } from "@/lib/planner";
import { formatPlannerDate } from "@/lib/planner";
import { formatCurrency } from "@/lib/format";
import { useHorizonStore } from "@/components/store/HorizonStore";
import SwipeToDelete from "@/components/shared/SwipeToDelete";

type Props = {
  entry: PlannerEntry;
  // Cumulative budget balance after this entry posted (Fudget-style). When
  // omitted, only the row's own signed amount is rendered.
  runningBalance?: number;
  // The Planner page groups rows by day with a header that already labels
  // the date, so callers there suppress the per-row date. Detail callers
  // outside that group view leave it on by default.
  showDate?: boolean;
  // Optional element rendered to the left of the row body. The Planner
  // page passes a draggable grip when reorder is enabled; other callers
  // can leave it undefined and skip the slot entirely.
  dragHandle?: ReactNode;
};

export default function PlannerEntryRow({
  entry,
  runningBalance,
  showDate = true,
  dragHandle,
}: Props) {
  const { deletePlannerEntry } = useHorizonStore();
  const isIncome = entry.amount > 0;
  const display = isIncome
    ? `+${formatCurrency(entry.amount)}`
    : `−${formatCurrency(Math.abs(entry.amount))}`;

  function handleDelete() {
    // No undo toast for Planner entries — the undo banner sits over the
    // quick-add bar and other rows, and a Planner delete is cheap to
    // re-create from the inline form.
    deletePlannerEntry(entry.id);
  }

  return (
    <SwipeToDelete
      onDelete={handleDelete}
      ariaLabel={`Delete entry ${entry.label}`}
    >
      <div className="flex w-full items-stretch bg-card">
        {dragHandle}
        <Link
          href={`/planner/${entry.id}`}
          className="flex flex-1 items-center gap-3 px-4 py-3 min-w-0"
        >
          <span
            aria-hidden
            className={`h-8 w-1 shrink-0 rounded-full ${
              isIncome ? "bg-emerald-400/70" : "bg-rose-400/70"
            }`}
          />
          <div className="flex-1 min-w-0">
            <p className="text-base font-semibold truncate">{entry.label}</p>
            {showDate && (
              <p className="mt-0.5 text-xs text-fg/55">
                {formatPlannerDate(entry.date)}
              </p>
            )}
          </div>
          <div className="text-right shrink-0">
            <span
              className={`block text-base font-bold tabular-nums ${
                isIncome ? "text-emerald-400" : "text-rose-400"
              }`}
            >
              {display}
            </span>
            {runningBalance !== undefined && (
              <span
                className={`mt-0.5 block text-[11px] font-semibold tabular-nums ${
                  runningBalance < 0 ? "text-rose-300" : "text-fg/55"
                }`}
              >
                {formatCurrency(runningBalance)}
              </span>
            )}
          </div>
        </Link>
      </div>
    </SwipeToDelete>
  );
}
