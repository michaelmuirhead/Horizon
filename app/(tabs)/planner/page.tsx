"use client";

import Link from "next/link";
import { useMemo, useState, type DragEvent } from "react";
import {
  ChevronLeft,
  ChevronRight,
  GripVertical,
  Plus,
} from "lucide-react";
import PageTitle from "@/components/layout/PageTitle";
import PlannerEntryRow from "@/components/planner/PlannerEntryRow";
import PlannerFAB from "@/components/planner/PlannerFAB";
import QuickAddBar from "@/components/planner/QuickAddBar";
import AnimatedCurrency from "@/components/shared/AnimatedCurrency";
import { useHorizonStore } from "@/components/store/HorizonStore";
import { formatCurrency } from "@/lib/format";
import {
  formatPlannerDayHeader,
  formatPlannerWeekday,
  groupEntriesByDay,
  summarizeEntries,
} from "@/lib/planner";

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

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Pick a sensible default date for the quick-add bar: today when looking
// at the current month, otherwise the 1st of the picked month so a fresh
// entry doesn't silently jump out of the page the user is staring at.
function defaultDateForMonth(monthKey: string): string {
  const today = todayIso();
  if (monthKeyFromIso(today) === monthKey) return today;
  return `${monthKey}-01`;
}

type DragState = {
  id: string;
  // Captured up front so onDragOver can refuse drops on a different day
  // without re-deriving the source's date for every hover frame.
  date: string;
};

export default function PlannerPage() {
  const { plannerEntries, reorderPlannerEntry } = useHorizonStore();
  const now = new Date();
  const [monthKey, setMonthKey] = useState<string>(() =>
    monthKeyOf(now.getFullYear(), now.getMonth()),
  );
  const [drag, setDrag] = useState<DragState | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  function handleDragStart(id: string, date: string) {
    return (e: DragEvent<HTMLElement>) => {
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", id);
      setDrag({ id, date });
    };
  }

  function handleDragOver(targetId: string, targetDate: string) {
    return (e: DragEvent<HTMLElement>) => {
      if (!drag) return;
      // Within-day reorder only — refuse the drop visually so users get
      // a clear "no" cursor instead of a silent no-op on release.
      if (drag.date !== targetDate) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      if (dragOverId !== targetId) setDragOverId(targetId);
    };
  }

  function handleDrop(targetId: string, targetDate: string) {
    return (e: DragEvent<HTMLElement>) => {
      if (!drag) return;
      if (drag.date !== targetDate) return;
      e.preventDefault();
      if (drag.id !== targetId) reorderPlannerEntry(drag.id, targetId);
      setDrag(null);
      setDragOverId(null);
    };
  }

  function handleDragEnd() {
    setDrag(null);
    setDragOverId(null);
  }

  const monthEntries = useMemo(
    () =>
      plannerEntries.filter((e) => monthKeyFromIso(e.date) === monthKey),
    [plannerEntries, monthKey],
  );

  const summary = useMemo(() => summarizeEntries(monthEntries), [monthEntries]);
  const dayGroups = useMemo(
    () => groupEntriesByDay(monthEntries),
    [monthEntries],
  );

  const balanceTone =
    summary.balance > 0
      ? "text-emerald-400"
      : summary.balance < 0
        ? "text-rose-400"
        : "text-fg";

  const newHref = `/planner/new?month=${monthKey}`;
  const quickAddDate = defaultDateForMonth(monthKey);

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
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-fg/55">
                In
              </p>
              <p className="mt-1 text-base font-bold tabular-nums text-emerald-400">
                {formatCurrency(summary.income)}
              </p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-fg/55">
                Out
              </p>
              <p className="mt-1 text-base font-bold tabular-nums text-rose-400">
                {formatCurrency(summary.expense)}
              </p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-fg/55">
                Balance
              </p>
              <p
                className={`mt-1 text-base font-bold tabular-nums ${balanceTone}`}
              >
                {formatCurrency(summary.balance)}
              </p>
            </div>
          </div>
          <div className="mt-4 border-t border-fg/10 pt-4 text-center">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-fg/55">
              {labelFromMonthKey(monthKey)}
            </p>
            <p className="mt-1 text-4xl font-extrabold tabular-nums">
              <AnimatedCurrency
                value={summary.balance}
                toneClassName={balanceTone}
              />
            </p>
            <p className="mt-1 text-xs text-fg/55">
              {monthEntries.length === 0
                ? "Nothing logged for this month yet."
                : `${monthEntries.length} ${monthEntries.length === 1 ? "entry" : "entries"} this month`}
            </p>
          </div>
        </div>

        <div className="mt-4">
          <QuickAddBar date={quickAddDate} />
        </div>
      </div>

      {dayGroups.length === 0 ? (
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
        <div className="mt-4 space-y-5">
          {dayGroups.map((group) => {
            const dayTone =
              group.dayTotal > 0
                ? "text-emerald-400"
                : group.dayTotal < 0
                  ? "text-rose-400"
                  : "text-fg/60";
            const daySign =
              group.dayTotal > 0 ? "+" : group.dayTotal < 0 ? "−" : "";
            return (
              <section key={group.date}>
                <header className="flex items-baseline justify-between px-4 pb-1.5">
                  <div className="flex items-baseline gap-2">
                    <span className="text-xs font-bold uppercase tracking-wide text-fg/55">
                      {formatPlannerWeekday(group.date)}
                    </span>
                    <span className="text-sm font-semibold text-fg/80">
                      {formatPlannerDayHeader(group.date)}
                    </span>
                  </div>
                  <span
                    className={`text-xs font-bold tabular-nums ${dayTone}`}
                  >
                    {daySign}
                    {formatCurrency(Math.abs(group.dayTotal))}
                  </span>
                </header>
                <ul className="divide-y divide-fg/5 border-y border-fg/5">
                  {group.rows.map(({ entry, running }) => (
                    <li
                      key={entry.id}
                      onDragOver={handleDragOver(entry.id, group.date)}
                      onDrop={handleDrop(entry.id, group.date)}
                    >
                      <PlannerEntryRow
                        entry={entry}
                        runningBalance={running}
                        showDate={false}
                        isDragging={drag?.id === entry.id}
                        isDropTarget={
                          dragOverId === entry.id && drag?.id !== entry.id
                        }
                        dragHandle={
                          <button
                            type="button"
                            aria-label={`Reorder ${entry.label}`}
                            draggable
                            onDragStart={handleDragStart(entry.id, entry.date)}
                            onDragEnd={handleDragEnd}
                            className="grid w-7 shrink-0 place-items-center bg-card text-fg/30 cursor-grab active:cursor-grabbing"
                          >
                            <GripVertical size={14} />
                          </button>
                        }
                      />
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}

      {/* Tail spacer so the floating add button never covers the last
          entry — the bottom-nav inset on `main` only clears the nav, not
          the FAB stacked above it. */}
      <div aria-hidden className="h-24" />

      <PlannerFAB monthKey={monthKey} />
    </>
  );
}
