"use client";

import Link from "next/link";
import { use, useEffect, useMemo, useRef, useState } from "react";
import { GripVertical, Minus, Plus } from "lucide-react";
import SubpageHeader from "@/components/layout/SubpageHeader";
import PlannerEntryRow from "@/components/planner/PlannerEntryRow";
import { usePlannerReorderDrag } from "@/components/planner/usePlannerReorderDrag";
import { useHorizonStore } from "@/components/store/HorizonStore";
import {
  entriesWithRunningBalance,
  summarizeEntries,
} from "@/lib/planner";
import { formatCurrency } from "@/lib/format";

export default function PlannerBudgetPage({
  params,
}: {
  params: Promise<{ folderId: string; budgetId: string }>;
}) {
  const { folderId, budgetId } = use(params);
  const {
    plannerFolders,
    plannerBudgets,
    plannerEntries,
    setPlannerEntryPaid,
    deletePlannerEntry,
    reorderPlannerEntry,
    markUndoable,
  } = useHorizonStore();

  const folder = plannerFolders.find((f) => f.id === folderId);
  const budget = plannerBudgets.find((b) => b.id === budgetId);

  const budgetEntries = useMemo(
    () => plannerEntries.filter((e) => e.budgetId === budgetId),
    [plannerEntries, budgetId],
  );

  const rows = useMemo(
    () => entriesWithRunningBalance(budgetEntries),
    [budgetEntries],
  );

  const summary = useMemo(
    () => summarizeEntries(budgetEntries),
    [budgetEntries],
  );

  const { rowStyle, gripProps } = usePlannerReorderDrag({
    onReorder: reorderPlannerEntry,
  });

  // Measure the fixed bottom strip so the tail spacer below the list
  // matches its actual height. The strip's content varies with totals
  // (e.g. multi-line balances on smaller phones) and the tab layout's
  // pb-28 only clears the bottom nav, not the strip stacked on top of
  // it — a static pixel guess clipped the last entry on iPhone PWAs.
  const stripRef = useRef<HTMLDivElement | null>(null);
  const [stripHeight, setStripHeight] = useState<number>(260);
  useEffect(() => {
    const el = stripRef.current;
    if (!el) return;
    const measure = () => setStripHeight(el.offsetHeight);
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  if (!folder || !budget) {
    return (
      <>
        <SubpageHeader title="Budget" backHref="/planner" />
        <div className="px-4 pt-10 text-center text-fg/70">
          <p className="text-base">Budget not found.</p>
          <Link
            href="/planner"
            className="mt-4 inline-block text-accent text-base font-bold"
          >
            Back to Planner
          </Link>
        </div>
      </>
    );
  }

  const balanceTone =
    summary.balance > 0
      ? "text-emerald-400"
      : summary.balance < 0
        ? "text-rose-400"
        : "text-fg";

  return (
    <>
      <SubpageHeader title={budget.name} backHref={`/planner/${folderId}`} />

      {rows.length === 0 ? (
        <div className="px-4 py-12 text-center text-sm text-fg/55">
          No entries yet. Tap{" "}
          <span className="font-bold text-emerald-400">Add Income</span> or{" "}
          <span className="font-bold text-rose-400">Add Expense</span> below.
        </div>
      ) : (
        <ul className="mt-2 divide-y divide-fg/5 border-y border-fg/5">
          {rows.map(({ entry, running }) => {
            const handle = gripProps(entry.id, entry.id);
            return (
              <li
                key={entry.id}
                data-planner-entry={entry.id}
                data-planner-date={budgetId}
                style={rowStyle(entry.id)}
              >
                <PlannerEntryRow
                  entry={entry}
                  runningBalance={running}
                  href={`/planner/${folderId}/${budgetId}/${entry.id}`}
                  onTogglePaid={() =>
                    setPlannerEntryPaid(entry.id, !entry.paid)
                  }
                  onDelete={() => {
                    markUndoable(`Entry "${entry.label}" deleted`);
                    deletePlannerEntry(entry.id);
                  }}
                  dragHandle={
                    <button
                      type="button"
                      aria-label={`Reorder ${entry.label}`}
                      {...handle}
                      className="grid w-7 shrink-0 place-items-center bg-card text-fg/30 cursor-grab active:cursor-grabbing touch-none select-none"
                    >
                      <GripVertical size={14} />
                    </button>
                  }
                />
              </li>
            );
          })}
        </ul>
      )}

      <div aria-hidden style={{ height: stripHeight + 16 }} />

      <div className="fixed inset-x-0 bottom-0 z-30 md:pl-20">
        <div
          ref={stripRef}
          className="mx-auto max-w-md md:max-w-3xl lg:max-w-5xl bg-page/95 backdrop-blur border-t border-fg/10 px-4 pt-3 pb-[calc(env(safe-area-inset-bottom)+88px)] md:pb-6 space-y-3"
        >
          <div className="flex items-end justify-between gap-3 text-xs">
            <div className="flex flex-col gap-0.5">
              <span className="flex items-baseline gap-1.5">
                <span className="text-fg/55">Income:</span>
                <span className="font-bold tabular-nums text-emerald-400">
                  +{formatCurrency(summary.income)}
                </span>
              </span>
              <span className="flex items-baseline gap-1.5">
                <span className="text-fg/55">Expenses:</span>
                <span className="font-bold tabular-nums text-rose-400">
                  −{formatCurrency(summary.expense)}
                </span>
              </span>
              <span className="flex items-baseline gap-1.5">
                <span className="text-fg/55">Paid:</span>
                <span className="font-bold tabular-nums text-amber-400">
                  −{formatCurrency(summary.paid)}
                </span>
              </span>
            </div>
            <div className="flex flex-col items-end">
              <span className="text-[11px] uppercase tracking-wide text-fg/55">
                Balance
              </span>
              <span
                className={`text-2xl font-extrabold tabular-nums ${balanceTone}`}
              >
                {summary.balance >= 0 ? "+" : "−"}
                {formatCurrency(Math.abs(summary.balance))}
              </span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Link
              href={`/planner/${folderId}/${budgetId}/new?direction=income`}
              className="flex items-center justify-center gap-2 rounded-2xl border border-emerald-400/40 px-3 py-3 text-base font-bold text-emerald-400"
            >
              <Plus size={16} strokeWidth={2.6} />
              Add Income
            </Link>
            <Link
              href={`/planner/${folderId}/${budgetId}/new?direction=expense`}
              className="flex items-center justify-center gap-2 rounded-2xl border border-rose-400/40 px-3 py-3 text-base font-bold text-rose-400"
            >
              <Minus size={16} strokeWidth={2.6} />
              Add Expense
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
