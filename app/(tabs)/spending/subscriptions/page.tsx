"use client";

import Link from "next/link";
import { CalendarRange, Repeat } from "lucide-react";
import SubpageHeader from "@/components/layout/SubpageHeader";
import { useHorizonStore } from "@/components/store/HorizonStore";
import {
  detectSubscriptions,
  totalMonthlySubscriptions,
} from "@/lib/subscriptions";
import { formatCurrency } from "@/lib/format";

const monthDayFmt = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
});

function parseIsoDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export default function SubscriptionsPage() {
  const { transactions } = useHorizonStore();
  const candidates = detectSubscriptions(transactions);
  const total = totalMonthlySubscriptions(candidates);
  const yearly = total * 12;

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
            {candidates.length === 0
              ? "No recurring monthly payees detected yet — log a few months of transactions and we'll spot them."
              : `${candidates.length} ${candidates.length === 1 ? "subscription" : "subscriptions"} · ${formatCurrency(yearly)} / yr`}
          </p>
        </div>

        {candidates.length > 0 && (
          <ul className="divide-y divide-fg/5 border-y border-fg/5">
            {candidates.map((c) => (
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
                <Link
                  href={`/spending?q=${encodeURIComponent(c.payee)}`}
                  className="mt-1 inline-block text-xs font-bold text-accent"
                >
                  See history
                </Link>
              </li>
            ))}
          </ul>
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
