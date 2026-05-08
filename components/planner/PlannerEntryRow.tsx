"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { Check, Copy, Pencil, Trash2 } from "lucide-react";
import type { PlannerEntry } from "@/lib/planner";
import { formatPlannerDate } from "@/lib/planner";
import { formatCurrency } from "@/lib/format";
import RowMenu from "@/components/planner/RowMenu";

type Props = {
  entry: PlannerEntry;
  // Cumulative budget balance after this entry posted, walking the
  // budget's entries in stored order.
  runningBalance: number;
  href: string;
  onTogglePaid: () => void;
  onDelete: () => void;
  onDuplicate?: () => void;
  // Optional element rendered to the left of the row body — the ledger
  // page passes a draggable grip when reorder is enabled.
  dragHandle?: ReactNode;
};

export default function PlannerEntryRow({
  entry,
  runningBalance,
  href,
  onTogglePaid,
  onDelete,
  onDuplicate,
  dragHandle,
}: Props) {
  const isIncome = entry.amount > 0;
  const paid = Boolean(entry.paid);

  const labelTone = isIncome ? "text-emerald-400" : "text-rose-400";
  const amountTone = isIncome ? "text-emerald-400" : "text-rose-400";
  const runningTone = runningBalance < 0 ? "text-rose-300" : "text-emerald-400";
  const dateTone = paid ? "text-amber-400" : "text-fg/45";

  const amountStr = isIncome
    ? `+ ${formatCurrency(entry.amount)}`
    : `− ${formatCurrency(Math.abs(entry.amount))}`;
  const runningStr = runningBalance < 0
    ? `− ${formatCurrency(Math.abs(runningBalance))}`
    : `+ ${formatCurrency(runningBalance)}`;

  return (
    <div className="flex w-full items-stretch bg-card">
      {dragHandle}
      <Link href={href} className="flex flex-1 items-center gap-3 px-3 py-3 min-w-0">
        <div className="flex-1 min-w-0">
          <p
            className={`truncate text-base font-bold ${labelTone} ${
              paid ? "line-through opacity-60" : ""
            }`}
          >
            {entry.label}
          </p>
        </div>
        <div className="text-right shrink-0 min-w-[5.5rem]">
          <span
            className={`block text-base font-bold tabular-nums ${amountTone} ${
              paid ? "line-through opacity-60" : ""
            }`}
          >
            {amountStr}
          </span>
          <span
            className={`mt-0.5 inline-block rounded-md px-1.5 py-0.5 text-[11px] font-bold tabular-nums ${runningTone} ${
              runningBalance < 0 ? "bg-rose-500/10" : "bg-emerald-500/10"
            }`}
          >
            {runningStr}
          </span>
        </div>
        <div
          className={`text-right shrink-0 w-16 text-xs font-semibold leading-tight ${dateTone}`}
        >
          {entry.date ? (
            formatPlannerDate(entry.date)
          ) : (
            <span className="text-fg/40">Date</span>
          )}
        </div>
      </Link>
      <RowMenu
        ariaLabel={`Actions for ${entry.label}`}
        items={[
          {
            label: paid ? "Mark unpaid" : "Mark paid",
            icon: <Check size={14} />,
            onClick: onTogglePaid,
          },
          ...(onDuplicate
            ? [
                {
                  label: "Duplicate",
                  icon: <Copy size={14} />,
                  onClick: onDuplicate,
                },
              ]
            : []),
          {
            label: "Edit",
            icon: <Pencil size={14} />,
            onClick: () => {
              // Falling through to the Link click would require dispatching
              // navigation imperatively; simpler is to let the user tap the
              // row body for edit and reserve the menu for non-edit ops.
              // We still expose Edit here as a discoverable action that
              // mirrors a normal tap.
              window.location.href = href;
            },
          },
          {
            label: "Delete",
            icon: <Trash2 size={14} />,
            destructive: true,
            onClick: onDelete,
          },
        ]}
      />
    </div>
  );
}
