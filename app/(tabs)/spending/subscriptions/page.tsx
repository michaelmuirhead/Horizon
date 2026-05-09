"use client";

import Link from "next/link";
import { useMemo } from "react";
import {
  CalendarRange,
  CheckCircle2,
  ChevronRight,
  Plus,
  Repeat,
} from "lucide-react";
import SubpageHeader from "@/components/layout/SubpageHeader";
import { useHorizonStore } from "@/components/store/HorizonStore";
import {
  detectSubscriptions,
  totalMonthlySubscriptions,
  type SubscriptionCandidate,
} from "@/lib/subscriptions";
import { formatCurrency } from "@/lib/format";
import {
  advanceDate,
  formatScheduledDate,
  type ScheduledTransaction,
} from "@/lib/scheduled";

const monthDayFmt = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
});

function parseIsoDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

// A scheduled transaction counts as a "tracked subscription" when it's a
// monthly transaction-kind outflow. We deliberately don't filter by
// category — users may file Netflix under "Entertainment" or "Streaming"
// and we shouldn't second-guess.
function isTrackedSubscription(s: ScheduledTransaction): boolean {
  return (
    s.kind !== "transfer" &&
    s.cadence === "monthly" &&
    s.amount < 0 &&
    !s.isReadyToAssign
  );
}

function buildTrackHref(c: SubscriptionCandidate): string {
  // Charges in the source data are stored as positive magnitudes on
  // the candidate; the form expects a signed amount, so negate for
  // outflow.
  const params = new URLSearchParams({
    label: c.payee,
    amount: (-c.averageAmount).toString(),
    category: c.category,
    cadence: "monthly",
    // Best guess at the next charge date — one cadence step past the
    // last seen date. The user can adjust on the form before saving.
    date: advanceDate(c.lastSeen, "monthly"),
    from: "/spending/subscriptions",
  });
  return `/spending/scheduled/new?${params.toString()}`;
}

export default function SubscriptionsPage() {
  const { transactions, scheduledTransactions } = useHorizonStore();
  const candidates = detectSubscriptions(transactions);

  const trackedSubs = useMemo(
    () => scheduledTransactions.filter(isTrackedSubscription),
    [scheduledTransactions],
  );

  // Skip detected candidates that already have a tracked match — the
  // user has already promoted them, no need to nag.
  const trackedPayees = useMemo(() => {
    const set = new Set<string>();
    for (const s of trackedSubs) {
      if (s.kind !== "transfer") set.add(s.payee.trim().toLowerCase());
    }
    return set;
  }, [trackedSubs]);

  const undetectedCandidates = useMemo(
    () =>
      candidates.filter(
        (c) => !trackedPayees.has(c.payee.trim().toLowerCase()),
      ),
    [candidates, trackedPayees],
  );

  // The "recurring monthly spend" headline combines tracked monthly
  // outflows with detected-but-not-yet-tracked ones so the total
  // doesn't drop the second a user pins a candidate.
  const trackedMonthlyTotal = trackedSubs.reduce(
    (sum, s) => sum + (s.kind !== "transfer" ? -s.amount : 0),
    0,
  );
  const detectedMonthlyTotal = totalMonthlySubscriptions(undetectedCandidates);
  const total = trackedMonthlyTotal + detectedMonthlyTotal;
  const yearly = total * 12;
  const totalCount = trackedSubs.length + undetectedCandidates.length;

  return (
    <>
      <SubpageHeader title="Subscriptions" backHref="/spending" />
      <div className="px-4 pt-2 pb-10 space-y-3">
        <div className="rounded-2xl bg-card p-5">
          <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-fg/55">
            <Repeat size={11} strokeWidth={2.4} />
            Recurring monthly spend
          </p>
          <p className="mt-1 text-3xl font-extrabold tabular-nums">
            {formatCurrency(total)}
            <span className="text-base font-bold text-fg/55"> /mo</span>
          </p>
          <p className="mt-1 text-xs text-fg/55">
            {totalCount === 0
              ? "No recurring monthly payees yet — log a few months of transactions and we'll spot them."
              : `${totalCount} ${totalCount === 1 ? "subscription" : "subscriptions"} · ${formatCurrency(yearly)} / yr`}
          </p>
        </div>

        {trackedSubs.length > 0 && (
          <section>
            <div className="flex items-center justify-between px-1 pb-1.5">
              <h2 className="text-xs font-bold uppercase tracking-wide text-fg/55">
                Tracked
              </h2>
              <span className="text-xs font-semibold tabular-nums text-fg/55">
                {formatCurrency(trackedMonthlyTotal)} /mo
              </span>
            </div>
            <ul className="divide-y divide-fg/5 border-y border-fg/5">
              {trackedSubs.map((s) => (
                <li key={s.id} className="bg-card px-4 py-3">
                  <Link
                    href={`/spending/scheduled/${s.id}`}
                    className="flex items-center gap-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-base font-bold truncate">
                        {s.kind !== "transfer" ? s.payee : "Transfer"}
                      </p>
                      <p className="mt-0.5 text-xs text-fg/55 truncate">
                        Next {formatScheduledDate(s.nextDate)}
                        {s.kind !== "transfer" ? ` · ${s.category}` : ""}
                      </p>
                    </div>
                    <span className="text-base font-bold tabular-nums text-fg shrink-0">
                      {formatCurrency(
                        s.kind !== "transfer" ? Math.abs(s.amount) : s.amount,
                      )}
                    </span>
                    <ChevronRight size={16} className="text-fg/40 shrink-0" />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {undetectedCandidates.length > 0 && (
          <section>
            <div className="flex items-center justify-between px-1 pb-1.5">
              <h2 className="text-xs font-bold uppercase tracking-wide text-fg/55">
                Detected
              </h2>
              <span className="text-xs font-semibold tabular-nums text-fg/55">
                {formatCurrency(detectedMonthlyTotal)} /mo
              </span>
            </div>
            <ul className="divide-y divide-fg/5 border-y border-fg/5">
              {undetectedCandidates.map((c) => (
                <li key={c.payee} className="bg-card px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-base font-bold truncate">{c.payee}</p>
                      <p className="mt-0.5 text-xs text-fg/55 truncate">
                        <CalendarRange
                          size={10}
                          className="inline mr-1"
                          strokeWidth={2.4}
                        />
                        Last seen {monthDayFmt.format(parseIsoDate(c.lastSeen))} · {c.hits} hits · {c.category}
                      </p>
                    </div>
                    <span className="text-base font-bold tabular-nums shrink-0">
                      {formatCurrency(c.averageAmount)}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center gap-3">
                    <Link
                      href={`/spending?q=${encodeURIComponent(c.payee)}`}
                      className="text-xs font-bold text-fg/70"
                    >
                      See history
                    </Link>
                    <Link
                      href={buildTrackHref(c)}
                      className="ml-auto inline-flex items-center gap-1 rounded-full bg-accent/15 px-3 py-1 text-xs font-bold text-accent"
                    >
                      <Plus size={12} strokeWidth={2.6} />
                      Track
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        {totalCount > 0 && (
          <p className="flex items-center gap-1.5 px-2 text-[11px] text-fg/45">
            <CheckCircle2 size={11} strokeWidth={2.4} />
            Tracked items show up on the Calendar and Upcoming pages.
          </p>
        )}

        <p className="px-2 text-[11px] text-fg/45">
          Detection is local: payee + similar amounts + roughly monthly
          gaps. Cancellations are between you and the merchant — this just
          surfaces what to consider.
        </p>
      </div>
    </>
  );
}
