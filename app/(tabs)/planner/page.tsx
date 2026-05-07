"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import PageTitle from "@/components/layout/PageTitle";
import PlannerEntryRow from "@/components/planner/PlannerEntryRow";
import { useHorizonStore } from "@/components/store/HorizonStore";
import { formatCurrency } from "@/lib/format";

const monthFmt = new Intl.DateTimeFormat("en-US", {
  month: "long",
  year: "numeric",
});

function monthKeyOf(year: number, monthIndex: number): string {
  return `${year}-${String(monthIndex + 1).padStart(2, "0")}`;
}

function monthKeyFromIso(iso: string): string {
  // Pull YYYY-MM from a YYYY-MM-DD string without parsing into a Date so
  // we don't lose the day to TZ shifts.
  return iso.slice(0, 7);
}

function shiftMonthKey(key: string, delta: number): string {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return monthKeyOf(d.getFullYear(), d.getMonth());
}

function labelFromMonthKey(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return monthFmt.format(new Date(y, m - 1, 1));
}

export default function PlannerPage() {
  const { plannerEntries } = useHorizonStore();
  const now = new Date();
  const [monthKey, setMonthKey] = useState<string>(() =>
    monthKeyOf(now.getFullYear(), now.getMonth()),
  );

  // Slice the flat entry list down to the picked month. Sort chronologically
  // so the running balance accrues in date order; we reverse for display so
  // newest-on-top mirrors Fudget's layout while the per-row balance still
  // reads "what the budget was at after this entry posted".
  const monthRows = useMemo(() => {
    const inMonth = plannerEntries.filter(
      (e) => monthKeyFromIso(e.date) === monthKey,
    );
    const ascending = inMonth.slice().sort((a, b) => {
      if (a.date !== b.date) return a.date < b.date ? -1 : 1;
      // Stable secondary by id so same-day entries hold a consistent order.
      return a.id < b.id ? -1 : 1;
    });
    let running = 0;
    const withBalances = ascending.map((entry) => {
      running += entry.amount;
      return { entry, running };
    });
    return withBalances.reverse();
  }, [plannerEntries, monthKey]);

  const monthTotal = monthRows.reduce((sum, r) => sum + r.entry.amount, 0);
  const tone =
    monthTotal > 0
      ? "text-emerald-400"
      : monthTotal < 0
        ? "text-rose-400"
        : "text-fg";

  const newHref = `/planner/new?month=${monthKey}`;

  return (
    <>
      <div className="px-4 pt-[max(env(safe-area-inset-top),12px)]">
        <div className="flex justify-end">
          <Link
            href={newHref}
            aria-label="Add Planner Entry"
            className="grid h-10 w-10 place-items-center rounded-full bg-card-elevated"
          >
            <Plus size={20} strokeWidth={2.5} />
          </Link>
        </div>

        <div className="mt-4">
          <PageTitle>Planner</PageTitle>
        </div>

        <div className="mt-4 flex items-center justify-center gap-1">
          <button
            type="button"
            onClick={() => setMonthKey((k) => shiftMonthKey(k, -1))}
            aria-label="Previous month"
            className="grid h-9 w-9 place-items-center rounded-full hover:bg-card-elevated"
          >
            <ChevronLeft size={18} strokeWidth={2.5} />
          </button>
          <span className="min-w-[10rem] text-center text-lg font-bold">
            {labelFromMonthKey(monthKey)}
          </span>
          <button
            type="button"
            onClick={() => setMonthKey((k) => shiftMonthKey(k, 1))}
            aria-label="Next month"
            className="grid h-9 w-9 place-items-center rounded-full hover:bg-card-elevated"
          >
            <ChevronRight size={18} strokeWidth={2.5} />
          </button>
        </div>

        <div className="mt-4 rounded-3xl bg-card p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-fg/60">
            {labelFromMonthKey(monthKey)} balance
          </p>
          <p className={`mt-1 text-4xl font-extrabold tabular-nums ${tone}`}>
            {formatCurrency(monthTotal)}
          </p>
          <p className="mt-1 text-xs text-fg/55">
            {monthRows.length === 0
              ? "Nothing logged for this month yet."
              : `${monthRows.length} ${monthRows.length === 1 ? "entry" : "entries"} this month`}
          </p>
        </div>
      </div>

      {monthRows.length === 0 ? (
        <div className="px-4 py-12 text-center text-fg/55">
          <p>
            Add an entry to start budgeting{" "}
            <span className="font-semibold text-fg/80">
              {labelFromMonthKey(monthKey)}
            </span>
            .
          </p>
          <Link
            href={newHref}
            className="mt-3 inline-flex items-center gap-1.5 text-sm font-bold text-accent"
          >
            <Plus size={14} strokeWidth={2.5} />
            New entry
          </Link>
        </div>
      ) : (
        <ul className="mt-4 divide-y divide-fg/5 border-y border-fg/5">
          {monthRows.map(({ entry, running }) => (
            <li key={entry.id}>
              <PlannerEntryRow entry={entry} runningBalance={running} />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
