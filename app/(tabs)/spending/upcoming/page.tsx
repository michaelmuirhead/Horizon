"use client";

import Link from "next/link";
import { CalendarClock, PlayCircle } from "lucide-react";
import SubpageHeader from "@/components/layout/SubpageHeader";
import { useHorizonStore } from "@/components/store/HorizonStore";
import {
  advanceDate,
  cadenceLabels,
  isoNDaysFromNow,
  todayIso,
  upcomingOccurrences,
  type ScheduledTransaction,
} from "@/lib/scheduled";
import { formatCurrency } from "@/lib/format";

const HORIZON_DAYS = 30;

const headerFmt = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
});

function parseIsoDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function dayHeading(iso: string, today: string): string {
  if (iso === today) return "Today";
  if (iso < today) return "Overdue";
  const tomorrow = (() => {
    const t = parseIsoDate(today);
    t.setDate(t.getDate() + 1);
    return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
  })();
  if (iso === tomorrow) return "Tomorrow";
  return headerFmt.format(parseIsoDate(iso));
}

function displayAmount(s: ScheduledTransaction): string {
  if (s.kind === "transfer") return formatCurrency(s.amount);
  return s.amount > 0
    ? `+${formatCurrency(s.amount)}`
    : `−${formatCurrency(Math.abs(s.amount))}`;
}

export default function UpcomingPage() {
  const { scheduledTransactions, addTransaction, addTransfer, updateScheduled } =
    useHorizonStore();

  const today = todayIso();
  const horizon = isoNDaysFromNow(HORIZON_DAYS);
  // Look slightly into the past too, so anything overdue still surfaces.
  const startWindow = isoNDaysFromNow(-30);
  const occurrences = upcomingOccurrences(
    scheduledTransactions,
    startWindow,
    horizon,
  );

  // Group by day for the agenda layout.
  const byDay = new Map<string, typeof occurrences>();
  for (const occ of occurrences) {
    const list = byDay.get(occ.date) ?? [];
    list.push(occ);
    byDay.set(occ.date, list);
  }
  const sortedDays = Array.from(byDay.keys()).sort();

  // Net cash flow over the visible window — quick sanity check for "is the
  // next month going to be tight?".
  let net = 0;
  let inflow = 0;
  let outflow = 0;
  for (const occ of occurrences) {
    if (occ.scheduled.kind === "transfer") continue;
    net += occ.scheduled.amount;
    if (occ.scheduled.amount > 0) inflow += occ.scheduled.amount;
    else outflow += -occ.scheduled.amount;
  }

  function postOccurrence(occ: { date: string; scheduled: ScheduledTransaction }) {
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
    // Only advance the underlying schedule when posting the *next* upcoming
    // hit — historic occurrences in a recurring series shouldn't bump it.
    if (occ.date === s.nextDate) {
      updateScheduled({ ...s, nextDate: advanceDate(s.nextDate, s.cadence) });
    }
  }

  return (
    <>
      <SubpageHeader
        title="Upcoming"
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
        <div className="rounded-2xl bg-card p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-fg/55">
            Next {HORIZON_DAYS} days
          </p>
          <div className="mt-2 grid grid-cols-3 gap-2 text-sm">
            <div>
              <p className="text-[11px] text-fg/45">Inflow</p>
              <p className="font-semibold tabular-nums text-emerald-400">
                {formatCurrency(inflow)}
              </p>
            </div>
            <div>
              <p className="text-[11px] text-fg/45">Outflow</p>
              <p className="font-semibold tabular-nums text-rose-300">
                {formatCurrency(outflow)}
              </p>
            </div>
            <div>
              <p className="text-[11px] text-fg/45">Net</p>
              <p
                className={`font-semibold tabular-nums ${
                  net < 0 ? "text-rose-300" : "text-emerald-400"
                }`}
              >
                {net < 0
                  ? `−${formatCurrency(Math.abs(net))}`
                  : `+${formatCurrency(net)}`}
              </p>
            </div>
          </div>
        </div>
      </div>

      {sortedDays.length === 0 ? (
        <div className="px-4 py-12 text-center text-fg/60">
          Nothing scheduled in the next {HORIZON_DAYS} days. Add a recurring
          item from{" "}
          <Link
            href="/spending/scheduled"
            className="text-accent font-bold"
          >
            Scheduled
          </Link>
          .
        </div>
      ) : (
        <div className="mt-3 space-y-3">
          {sortedDays.map((day) => {
            const items = byDay.get(day) ?? [];
            const heading = dayHeading(day, today);
            const overdue = day < today;
            return (
              <section key={day}>
                <div
                  className={`px-4 pb-1 text-xs font-bold uppercase tracking-wide ${
                    overdue ? "text-amber-400" : "text-fg/55"
                  }`}
                >
                  {heading}
                  {!overdue && heading !== headerFmt.format(parseIsoDate(day)) && (
                    <span className="ml-2 text-fg/40">
                      {headerFmt.format(parseIsoDate(day))}
                    </span>
                  )}
                </div>
                <ul className="divide-y divide-fg/5 border-y border-fg/5">
                  {items.map((occ, idx) => {
                    const s = occ.scheduled;
                    const isTransfer = s.kind === "transfer";
                    const titleText = isTransfer ? "Transfer" : s.payee;
                    const subtitle = isTransfer
                      ? `${s.fromAccount} → ${s.toAccount} · ${cadenceLabels[s.cadence]}`
                      : `${s.category} · ${cadenceLabels[s.cadence]}`;
                    return (
                      <li
                        key={`${s.id}-${occ.date}-${idx}`}
                        className="flex items-center gap-3 bg-card px-4 py-3"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold truncate">
                            {titleText}
                          </p>
                          <p className="mt-0.5 text-xs text-fg/55 truncate">
                            {subtitle}
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-1.5 shrink-0">
                          <span
                            className={`text-sm font-bold tabular-nums ${
                              isTransfer
                                ? "text-sky-300"
                                : s.amount > 0
                                  ? "text-emerald-400"
                                  : "text-fg"
                            }`}
                          >
                            {displayAmount(s)}
                          </span>
                          {day <= today && (
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
              </section>
            );
          })}
        </div>
      )}
    </>
  );
}
