"use client";

import Link from "next/link";
import { useMemo } from "react";
import {
  ArrowDownCircle,
  ArrowUpCircle,
  ChevronRight,
  Sparkles,
} from "lucide-react";
import SubpageHeader from "@/components/layout/SubpageHeader";
import { useHorizonStore } from "@/components/store/HorizonStore";
import { detectRecurring, isAlreadyScheduled } from "@/lib/recurring";
import type { RecurringCandidate } from "@/lib/recurring";
import { formatCurrency } from "@/lib/format";
import { advanceDate } from "@/lib/scheduled";

const cadenceLabels: Record<RecurringCandidate["cadence"], string> = {
  weekly: "Weekly",
  biweekly: "Every 2 weeks",
  monthly: "Monthly",
};

function trackHref(c: RecurringCandidate): string {
  // Detected amounts are stored as positive magnitudes; the scheduled
  // form expects a signed value. Income stays positive; expenses flip
  // to negative.
  const signedAmount =
    c.direction === "expense" ? -c.averageAmount : c.averageAmount;
  const params = new URLSearchParams({
    label: c.payee,
    amount: signedAmount.toString(),
    category: c.category,
    cadence: c.cadence,
    date: advanceDate(c.lastSeen, c.cadence),
    from: "/spending/recurring",
  });
  return `/spending/scheduled/new?${params.toString()}`;
}

export default function RecurringPage() {
  const { transactions, scheduledTransactions } = useHorizonStore();
  const candidates = useMemo(() => detectRecurring(transactions), [transactions]);
  // Hide ones already tracked. Detection runs from scratch every time
  // so as soon as a user taps Track + saves, the next render drops
  // that row from the list.
  const fresh = useMemo(
    () => candidates.filter((c) => !isAlreadyScheduled(c, scheduledTransactions)),
    [candidates, scheduledTransactions],
  );
  const income = fresh.filter((c) => c.direction === "income");
  const expense = fresh.filter((c) => c.direction === "expense");

  return (
    <>
      <SubpageHeader title="Detected recurring" backHref="/spending" />
      <div className="px-4 pt-2 pb-10 space-y-5">
        <p className="text-sm text-fg/65">
          Patterns spotted across your transaction history — paychecks,
          subscriptions, bills with a steady cadence. Tap{" "}
          <span className="font-bold text-fg/85">Track</span> to convert
          one into a scheduled transaction.
        </p>

        {fresh.length === 0 && (
          <div className="rounded-2xl bg-card p-6 text-center text-fg/65">
            <Sparkles
              size={20}
              strokeWidth={2.2}
              className="mx-auto text-accent"
            />
            <p className="mt-2 text-base font-semibold text-fg/85">
              Nothing new to suggest
            </p>
            <p className="mt-1 text-sm">
              Once you have three or more matching transactions for a payee,
              they&rsquo;ll show up here.
            </p>
          </div>
        )}

        {income.length > 0 && (
          <Section
            title="Income"
            icon={
              <ArrowDownCircle
                size={16}
                strokeWidth={2.4}
                className="text-emerald-400"
              />
            }
            items={income}
          />
        )}
        {expense.length > 0 && (
          <Section
            title="Expenses"
            icon={
              <ArrowUpCircle
                size={16}
                strokeWidth={2.4}
                className="text-rose-400"
              />
            }
            items={expense}
          />
        )}
      </div>
    </>
  );
}

function Section({
  title,
  icon,
  items,
}: {
  title: string;
  icon: React.ReactNode;
  items: RecurringCandidate[];
}) {
  return (
    <section className="space-y-2">
      <h2 className="flex items-center gap-2 px-1 text-xs font-bold uppercase tracking-wide text-fg/55">
        {icon}
        {title}
      </h2>
      <ul className="flex flex-col gap-2">
        {items.map((c) => (
          <li key={`${c.direction}|${c.payee}|${c.cadence}`}>
            <Row candidate={c} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function Row({ candidate }: { candidate: RecurringCandidate }) {
  const tone =
    candidate.direction === "income" ? "text-emerald-400" : "text-rose-400";
  const sign = candidate.direction === "income" ? "+" : "−";
  return (
    <Link
      href={trackHref(candidate)}
      className="flex items-center gap-3 rounded-2xl bg-card-elevated px-3 py-3"
    >
      <div className="flex-1 min-w-0">
        <p className="truncate text-base font-bold">{candidate.payee}</p>
        <p className="mt-0.5 text-xs text-fg/55">
          {cadenceLabels[candidate.cadence]} · {candidate.hits} seen · last{" "}
          {candidate.lastSeen}
        </p>
      </div>
      <div className="text-right shrink-0">
        <p className={`text-base font-bold tabular-nums ${tone}`}>
          {sign}
          {formatCurrency(candidate.averageAmount)}
        </p>
        <p className="mt-0.5 text-[11px] font-semibold text-accent">Track →</p>
      </div>
      <ChevronRight size={14} className="text-fg/40 shrink-0" />
    </Link>
  );
}
