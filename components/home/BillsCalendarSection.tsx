"use client";

import Link from "next/link";
import { useMemo } from "react";
import { CalendarDays, ChevronRight } from "lucide-react";
import CollapsibleCard from "./CollapsibleCard";
import { formatCurrency } from "@/lib/format";
import { useHorizonStore } from "@/components/store/HorizonStore";
import {
  isoNDaysFromNow,
  todayIso,
  upcomingOccurrences,
  type ScheduledTransaction,
  type UpcomingOccurrence,
} from "@/lib/scheduled";

const STRIP_DAYS = 14;
const PREVIEW_BILLS = 3;

const weekdayFmt = new Intl.DateTimeFormat("en-US", { weekday: "narrow" });
const dayHeaderFmt = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
});

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

type DayBucket = {
  inflow: number;
  outflow: number;
  hasTransfer: boolean;
};

function bucketOf(occ: UpcomingOccurrence, b: DayBucket | undefined): DayBucket {
  const next = b ?? { inflow: 0, outflow: 0, hasTransfer: false };
  if (occ.scheduled.kind === "transfer") {
    next.hasTransfer = true;
  } else if (occ.scheduled.amount > 0) {
    next.inflow += occ.scheduled.amount;
  } else {
    next.outflow += -occ.scheduled.amount;
  }
  return next;
}

function displayAmount(s: ScheduledTransaction): string {
  if (s.kind === "transfer") return formatCurrency(s.amount);
  return s.amount > 0
    ? `+${formatCurrency(s.amount)}`
    : `−${formatCurrency(Math.abs(s.amount))}`;
}

export default function BillsCalendarSection() {
  const { scheduledTransactions } = useHorizonStore();
  const today = todayIso();
  const horizonIso = isoNDaysFromNow(STRIP_DAYS - 1);

  const days = useMemo(() => {
    const start = parseIso(today);
    const out: { iso: string; date: Date }[] = [];
    for (let i = 0; i < STRIP_DAYS; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      out.push({ iso: isoOf(d), date: d });
    }
    return out;
  }, [today]);

  const occurrences = useMemo(
    () => upcomingOccurrences(scheduledTransactions, today, horizonIso),
    [scheduledTransactions, today, horizonIso],
  );

  const buckets = useMemo(() => {
    const m = new Map<string, DayBucket>();
    for (const occ of occurrences) {
      m.set(occ.date, bucketOf(occ, m.get(occ.date)));
    }
    return m;
  }, [occurrences]);

  const previewBills = occurrences.slice(0, PREVIEW_BILLS);

  return (
    <CollapsibleCard
      title="Bills Calendar"
      headerRight={
        <Link
          href="/spending/calendar"
          aria-label="Open full calendar"
          className="inline-flex items-center gap-1 rounded-full bg-card-elevated px-3 py-1.5 text-xs font-bold text-fg/85"
        >
          Open
          <ChevronRight size={14} strokeWidth={2.5} />
        </Link>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-7 gap-1">
          {days.map(({ iso, date }) => {
            const bucket = buckets.get(iso);
            const isToday = iso === today;
            return (
              <Link
                key={iso}
                href="/spending/calendar"
                aria-label={dayHeaderFmt.format(date)}
                className={`flex aspect-square flex-col items-center justify-start rounded-xl py-1.5 ${
                  isToday ? "bg-accent/15 ring-1 ring-accent" : "bg-card-elevated"
                }`}
              >
                <span className="text-[9px] font-bold uppercase tracking-wide text-fg/45">
                  {weekdayFmt.format(date)}
                </span>
                <span
                  className={`text-sm font-bold tabular-nums ${
                    isToday ? "text-accent" : ""
                  }`}
                >
                  {date.getDate()}
                </span>
                <div className="mt-0.5 flex items-center gap-0.5">
                  {bucket?.outflow ? (
                    <span
                      aria-hidden
                      className="h-1.5 w-1.5 rounded-full bg-rose-400"
                    />
                  ) : null}
                  {bucket?.inflow ? (
                    <span
                      aria-hidden
                      className="h-1.5 w-1.5 rounded-full bg-emerald-400"
                    />
                  ) : null}
                  {bucket?.hasTransfer ? (
                    <span
                      aria-hidden
                      className="h-1.5 w-1.5 rounded-full bg-sky-400"
                    />
                  ) : null}
                </div>
              </Link>
            );
          })}
        </div>

        {previewBills.length === 0 ? (
          <p className="text-center text-sm text-fg/55">
            No bills in the next {STRIP_DAYS} days.
          </p>
        ) : (
          <ul className="divide-y divide-fg/5">
            {previewBills.map((occ, idx) => {
              const s = occ.scheduled;
              const titleText = s.kind === "transfer" ? "Transfer" : s.payee;
              const tone =
                s.kind === "transfer"
                  ? "text-sky-300"
                  : s.amount > 0
                    ? "text-emerald-400"
                    : "text-fg";
              return (
                <li
                  key={`${s.id}-${occ.date}-${idx}`}
                  className="flex items-center gap-3 py-2.5"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold truncate">{titleText}</p>
                    <p className="mt-0.5 text-xs text-fg/55 truncate">
                      {dayHeaderFmt.format(parseIso(occ.date))}
                    </p>
                  </div>
                  <span
                    className={`text-sm font-bold tabular-nums ${tone}`}
                  >
                    {displayAmount(s)}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </CollapsibleCard>
  );
}
