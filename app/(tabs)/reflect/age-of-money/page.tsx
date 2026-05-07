"use client";

import { Clock } from "lucide-react";
import SubpageHeader from "@/components/layout/SubpageHeader";
import { useHorizonStore } from "@/components/store/HorizonStore";
import { trackingAccountNames } from "@/lib/accounts";
import {
  AGE_OF_MONEY_MIN_OUTFLOWS,
  ageOfMoneyByTransaction,
  ageOfMoneyDays,
} from "@/lib/reflect";
import { formatCurrency } from "@/lib/format";

const dateFmt = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

function formatIso(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return dateFmt.format(new Date(y, m - 1, d));
}

export default function AgeOfMoneyPage() {
  const { transactions, accounts } = useHorizonStore();
  const trackingNames = trackingAccountNames(accounts);
  const budgetTxs = transactions.filter((t) => !trackingNames.has(t.account));
  const days = ageOfMoneyDays(budgetTxs);
  const recent = ageOfMoneyByTransaction(budgetTxs);

  return (
    <>
      <SubpageHeader title="Age of Money" backHref="/reflect" />
      <div className="px-4 pt-2 pb-10 space-y-4">
        {days === null ? (
          <section className="rounded-3xl bg-accent/30 p-5 text-center">
            <Clock
              size={32}
              strokeWidth={2.2}
              className="mx-auto text-accent"
            />
            <h2 className="mt-3 text-xl font-extrabold">Spend more money!</h2>
            <p className="mt-2 text-base text-fg/85">
              Horizon needs a minimum of {AGE_OF_MONEY_MIN_OUTFLOWS} outflow
              transactions to compute Age of Money. You&rsquo;ll see your
              dollars&rsquo; average age once enough activity is tagged.
            </p>
          </section>
        ) : (
          <section className="rounded-3xl bg-card p-5">
            <p className="text-xs font-medium uppercase tracking-wide text-fg/60">
              Average age of dollars spent recently
            </p>
            <p className="mt-1 text-6xl font-extrabold tabular-nums">
              {days}
              <span className="ml-2 text-2xl font-bold text-fg/55">
                {days === 1 ? "day" : "days"}
              </span>
            </p>
            <p className="mt-2 text-sm text-fg/70">
              Computed FIFO across your last{" "}
              {AGE_OF_MONEY_MIN_OUTFLOWS} budget outflows. Higher numbers mean
              you&rsquo;re spending money you earned a while ago — generally a
              good sign.
            </p>
          </section>
        )}

        {recent.length > 0 && (
          <section className="rounded-2xl bg-card p-5">
            <h2 className="text-base font-bold">Recent Outflows</h2>
            <ul className="mt-2 divide-y divide-fg/5">
              {recent.map((s) => (
                <li
                  key={s.txId}
                  className="flex items-center justify-between py-2 text-sm"
                >
                  <span className="min-w-0 flex-1 truncate">
                    <span className="font-semibold">{s.payee}</span>
                    <span className="ml-2 text-xs text-fg/55">
                      {formatIso(s.date)}
                    </span>
                  </span>
                  <span className="ml-3 text-right shrink-0">
                    <span className="block tabular-nums">
                      −{formatCurrency(Math.abs(s.amount))}
                    </span>
                    <span className="block text-[11px] text-fg/55">
                      {s.averageAgeDays}d old
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </>
  );
}
