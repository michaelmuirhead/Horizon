"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { Check } from "lucide-react";
import type { PlannerEntry } from "@/lib/planner";
import { formatPlannerDate } from "@/lib/planner";
import { formatCurrency } from "@/lib/format";
import { useHorizonStore } from "@/components/store/HorizonStore";
import SwipeToDelete from "@/components/shared/SwipeToDelete";

type Props = {
  entry: PlannerEntry;
  // Cumulative budget balance after this entry posted (Fudget-style).
  runningBalance?: number;
  // Click target. Defaults to the legacy /planner/{id} edit route, but
  // pages inside the folder/budget hierarchy override this with the
  // full nested path.
  href?: string;
  // Toggling clears/uncovers the entry. Optional so the legacy month
  // view can still render rows without the cleared affordance.
  onTogglePaid?: () => void;
  // Optional override for delete. When provided, the row renders plain
  // (no swipe-to-delete) and the page is expected to wire delete via a
  // row menu. When omitted, the row falls back to the legacy
  // SwipeToDelete + store.deletePlannerEntry flow.
  onDelete?: () => void;
  // Drag handle node rendered on the leading edge of the row. Pages
  // building reorder UIs pass the grip button in here.
  dragHandle?: ReactNode;
};

export default function PlannerEntryRow({
  entry,
  runningBalance,
  href,
  onTogglePaid,
  onDelete,
  dragHandle,
}: Props) {
  const { deletePlannerEntry, markUndoable } = useHorizonStore();
  const isIncome = entry.amount > 0;
  const display = isIncome
    ? `+${formatCurrency(entry.amount)}`
    : `−${formatCurrency(Math.abs(entry.amount))}`;

  const target = href ?? `/planner/${entry.id}`;
  const paid = !!entry.paid;

  function handleLegacyDelete() {
    markUndoable(`Entry "${entry.label}" deleted`);
    deletePlannerEntry(entry.id);
  }

  const body = (
    <div className="flex w-full items-center gap-2 bg-card pr-2">
      {dragHandle}
      {onTogglePaid && (
        <button
          type="button"
          aria-pressed={paid}
          aria-label={paid ? "Mark as not paid" : "Mark as paid"}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onTogglePaid();
          }}
          className={`ml-2 grid h-5 w-5 place-items-center rounded-full border ${
            paid
              ? "border-emerald-400 bg-emerald-400/15 text-emerald-400"
              : "border-fg/30 text-transparent"
          }`}
        >
          <Check size={12} strokeWidth={3} />
        </button>
      )}
      <Link
        href={target}
        className="flex flex-1 min-w-0 items-center gap-3 py-3.5 pl-4"
      >
        <div className="flex-1 min-w-0">
          <p
            className={`text-base font-semibold truncate ${paid ? "line-through text-fg/55" : ""}`}
          >
            {entry.label}
          </p>
          <p className="mt-0.5 text-xs text-fg/55">
            {formatPlannerDate(entry.date)}
          </p>
        </div>
        <div className="text-right shrink-0">
          <span
            className={`block text-base font-bold tabular-nums ${
              isIncome ? "text-emerald-400" : "text-rose-400"
            } ${paid ? "opacity-60" : ""}`}
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
  );

  // New callers (folder/budget pages) handle delete via a row menu and
  // pass an onDelete prop — render plain so we don't double up on the
  // delete affordance.
  if (onDelete) return body;

  return (
    <SwipeToDelete
      onDelete={handleLegacyDelete}
      ariaLabel={`Delete entry ${entry.label}`}
    >
      {body}
    </SwipeToDelete>
  );
}
