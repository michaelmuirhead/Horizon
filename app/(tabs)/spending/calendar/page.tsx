"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  PlayCircle,
} from "lucide-react";
import SubpageHeader from "@/components/layout/SubpageHeader";
import { useHorizonStore } from "@/components/store/HorizonStore";
import { formatCurrency } from "@/lib/format";
import {
  advanceDate,
  cadenceLabels,
  todayIso,
  upcomingOccurrences,
  type ScheduledTransaction,
  type UpcomingOccurrence,
} from "@/lib/scheduled";

const monthLabelFmt = new Intl.DateTimeFormat("en-US", {
  month: "long",
  year: "numeric",
});

const fullDateFmt = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  month: "long",
  day: "numeric",
});

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];

function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

function isoOf(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function parseIso(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function monthKeyOf(year: number, monthIndex: number): string {
  return `${year}-${pad2(monthIndex + 1)}`;
}

function shiftMonthKey(key: string, delta: number): string {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return monthKeyOf(d.getFullYear(), d.getMonth());
}

// Build the 42-cell (6 weeks × 7 days) grid that anchors the visible
// month. Cells before / after the active month belong to the prior /
// next month and stay greyed out, but we still render bills landing on
// them so the user sees adjacency without having to flip the page.
function buildGridDates(monthKey: string): {
  cells: { iso: string; inMonth: boolean; date: Date }[];
  monthStart: string;
  monthEnd: string;
} {
  const [y, m] = monthKey.split("-").map(Number);
  const first = new Date(y, m - 1, 1);
  const startOffset = first.getDay();
  const gridStart = new Date(y, m - 1, 1 - startOffset);
  const cells: { iso: string; inMonth: boolean; date: Date }[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    cells.push({
      iso: isoOf(d),
      inMonth: d.getMonth() === m - 1,
      date: d,
    });
  }
  const monthStart = isoOf(new Date(y, m - 1, 1));
  const monthEnd = isoOf(new Date(y, m, 0));
  return { cells, monthStart, monthEnd };
}

type DayBucket = {
  total: number;
  inflow: number;
  outflow: number;
  hasTransfer: boolean;
  count: number;
};

function bucketize(occurrences: UpcomingOccurrence[]): Map<string, DayBucket> {
  const m = new Map<string, DayBucket>();
  for (const occ of occurrences) {
    const b = m.get(occ.date) ?? {
      total: 0,
      inflow: 0,
      outflow: 0,
      hasTransfer: false,
      count: 0,
    };
    b.count += 1;
    if (occ.scheduled.kind === "transfer") {
      b.hasTransfer = true;
    } else {
      b.total += occ.scheduled.amount;
      if (occ.scheduled.amount > 0) b.inflow += occ.scheduled.amount;
      else b.outflow += -occ.scheduled.amount;
    }
    m.set(occ.date, b);
  }
  return m;
}

export default function CalendarPage() {
  const today = todayIso();
  const {
    scheduledTransactions,
    addTransaction,
    addTransfer,
    updateScheduled,
  } = useHorizonStore();

  const [monthKey, setMonthKey] = useState(() => today.slice(0, 7));
  const [selectedIso, setSelectedIso] = useState<string>(today);

  const grid = useMemo(() => buildGridDates(monthKey), [monthKey]);

  // Expand occurrences across the full visible grid (incl. spillover
  // days) so every cell can light up if a bill lands on it.
  const occurrences = useMemo(
    () =>
      upcomingOccurrences(
        scheduledTransactions,
        grid.cells[0].iso,
        grid.cells[grid.cells.length - 1].iso,
      ),
    [scheduledTransactions, grid],
  );

  const buckets = useMemo(() => bucketize(occurrences), [occurrences]);

  const selectedItems = useMemo(
    () => occurrences.filter((occ) => occ.date === selectedIso),
    [occurrences, selectedIso],
  );

  const monthInflow = useMemo(() => {
    let v = 0;
    for (const occ of occurrences) {
      if (
        occ.date >= grid.monthStart &&
        occ.date <= grid.monthEnd &&
        occ.scheduled.kind !== "transfer" &&
        occ.scheduled.amount > 0
      ) {
        v += occ.scheduled.amount;
      }
    }
    return v;
  }, [occurrences, grid]);

  const monthOutflow = useMemo(() => {
    let v = 0;
    for (const occ of occurrences) {
      if (
        occ.date >= grid.monthStart &&
        occ.date <= grid.monthEnd &&
        occ.scheduled.kind !== "transfer" &&
        occ.scheduled.amount < 0
      ) {
        v += -occ.scheduled.amount;
      }
    }
    return v;
  }, [occurrences, grid]);

  function postOccurrence(occ: UpcomingOccurrence) {
    const s = occ.scheduled;
    if (s.kind === "transfer") {
      addTransfer({
        date: occ.date,
        fromAccount: s.fromAccount,
        toAccount: s.toAccount,
        amount: s.amount,
        cleared: s.cleared ?? false,
        memo: s.memo,
      });
    } else {
      addTransaction({
        date: occ.date,
        payee: s.payee,
        category: s.category,
        amount: s.amount,
        account: s.account,
        cleared: false,
        memo: s.memo,
        isReadyToAssign: s.isReadyToAssign,
      });
    }
    if (occ.date === s.nextDate) {
      updateScheduled({ ...s, nextDate: advanceDate(s.nextDate, s.cadence) });
    }
  }

  return (
    <>
      <SubpageHeader
        title="Calendar"
        backHref="/spending"
        trailing={
          <Link
            href="/spending/scheduled"
            aria-label="Manage scheduled"
            className="grid h-10 w-10 place-items-center rounded-full bg-card-elevated"
          >
            <CalendarClock size={18} strokeWidth={2.2} />
          </Link>
        }
      />

      <div className="px-4 pt-2">
        <div className="flex items-center justify-center gap-1">
          <button
            type="button"
            onClick={() => setMonthKey((k) => shiftMonthKey(k, -1))}
            aria-label="Previous month"
            className="grid h-9 w-9 place-items-center rounded-full hover:bg-card-elevated"
          >
            <ChevronLeft size={18} strokeWidth={2.5} />
          </button>
          <span className="min-w-[10rem] text-center text-lg font-bold">
            {monthLabelFmt.format(parseIso(`${monthKey}-01`))}
          </span>
          <button
            type="button"
            onClick={() => setMonthKey((k) => shiftMonthKey(k, 1))}
            aria-label="Next month"
            className="grid h-9 w-9 place-items-center rounded-full hover:bg-card-elevated"
          >
            <ChevronRight size={18} strokeWidth={2.5} />
          </button>
          <button
            type="button"
            onClick={() => {
              setMonthKey(today.slice(0, 7));
              setSelectedIso(today);
            }}
            className="ml-1 rounded-full bg-card-elevated px-3 py-1 text-xs font-bold text-fg/80"
          >
            Today
          </button>
        </div>

        <div className="mt-3 rounded-2xl bg-card p-3">
          <div className="grid grid-cols-7 text-center">
            {WEEKDAYS.map((w, i) => (
              <span
                key={`${w}-${i}`}
                className="pb-1 text-[10px] font-bold uppercase tracking-wide text-fg/45"
              >
                {w}
              </span>
            ))}
            {grid.cells.map(({ iso, inMonth }) => {
              const bucket = buckets.get(iso);
              const isToday = iso === today;
              const isSelected = iso === selectedIso;
              const dayNum = parseIso(iso).getDate();
              return (
                <button
                  type="button"
                  key={iso}
                  onClick={() => setSelectedIso(iso)}
                  aria-label={fullDateFmt.format(parseIso(iso))}
                  aria-pressed={isSelected}
                  className={`relative flex aspect-square flex-col items-center justify-start py-1.5 text-xs ${
                    inMonth ? "text-fg" : "text-fg/30"
                  } ${
                    isSelected
                      ? "rounded-xl bg-accent/20 ring-1 ring-accent"
                      : isToday
                        ? "rounded-xl ring-1 ring-fg/30"
                        : ""
                  }`}
                >
                  <span
                    className={`text-sm font-bold tabular-nums ${
                      isToday ? "text-accent" : ""
                    }`}
                  >
                    {dayNum}
                  </span>
                  {bucket && (
                    <div className="mt-1 flex items-center gap-0.5">
                      {bucket.outflow > 0 && (
                        <span
                          aria-hidden
                          className="h-1.5 w-1.5 rounded-full bg-rose-400"
                        />
                      )}
                      {bucket.inflow > 0 && (
                        <span
                          aria-hidden
                          className="h-1.5 w-1.5 rounded-full bg-emerald-400"
                        />
                      )}
                      {bucket.hasTransfer && (
                        <span
                          aria-hidden
                          className="h-1.5 w-1.5 rounded-full bg-sky-400"
                        />
                      )}
                      {bucket.count > 3 && (
                        <span className="ml-0.5 text-[9px] font-bold leading-none text-fg/55">
                          +{bucket.count - 3}
                        </span>
                      )}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-3 rounded-2xl bg-card p-4">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-fg/55">
                Bills in
              </p>
              <p className="mt-0.5 text-base font-bold tabular-nums text-emerald-400">
                {formatCurrency(monthInflow)}
              </p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-fg/55">
                Bills out
              </p>
              <p className="mt-0.5 text-base font-bold tabular-nums text-rose-400">
                {formatCurrency(monthOutflow)}
              </p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-fg/55">
                Net
              </p>
              <p
                className={`mt-0.5 text-base font-bold tabular-nums ${
                  monthInflow - monthOutflow < 0
                    ? "text-rose-400"
                    : "text-emerald-400"
                }`}
              >
                {monthInflow - monthOutflow >= 0 ? "+" : "−"}
                {formatCurrency(Math.abs(monthInflow - monthOutflow))}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-3">
        <div className="px-4 pb-1 text-xs font-bold uppercase tracking-wide text-fg/55">
          {fullDateFmt.format(parseIso(selectedIso))}
        </div>
        {selectedItems.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-fg/55">
            No bills land on this day.
          </div>
        ) : (
          <ul className="divide-y divide-fg/5 border-y border-fg/5">
            {selectedItems.map((occ, idx) => {
              const s = occ.scheduled;
              const isTransfer = s.kind === "transfer";
              const titleText = isTransfer ? "Transfer" : s.payee;
              const subtitle = isTransfer
                ? `${s.fromAccount} → ${s.toAccount} · ${cadenceLabels[s.cadence]}`
                : `${s.category} · ${cadenceLabels[s.cadence]}`;
              const display = isTransfer
                ? formatCurrency(s.amount)
                : s.amount > 0
                  ? `+${formatCurrency(s.amount)}`
                  : `−${formatCurrency(Math.abs(s.amount))}`;
              const tone = isTransfer
                ? "text-sky-300"
                : s.amount > 0
                  ? "text-emerald-400"
                  : "text-fg";
              return (
                <li
                  key={`${s.id}-${occ.date}-${idx}`}
                  className="flex items-center gap-3 bg-card px-4 py-3"
                >
                  <Link
                    href={`/spending/scheduled/${s.id}`}
                    className="flex-1 min-w-0"
                  >
                    <p className="text-sm font-bold truncate">{titleText}</p>
                    <p className="mt-0.5 text-xs text-fg/55 truncate">
                      {subtitle}
                    </p>
                  </Link>
                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    <span
                      className={`text-sm font-bold tabular-nums ${tone}`}
                    >
                      {display}
                    </span>
                    {selectedIso <= today && (
                      <button
                        type="button"
                        onClick={() => postOccurrence(occ)}
                        className="flex items-center gap-1 text-[11px] font-bold text-accent"
                      >
                        <PlayCircle size={12} strokeWidth={2.4} />
                        Post
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </>
  );
}
