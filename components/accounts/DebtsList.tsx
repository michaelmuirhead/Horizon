"use client";

import Link from "next/link";
import { PlusCircle } from "lucide-react";
import { useHorizonStore } from "@/components/store/HorizonStore";
import { listDebts, summarizeDebts } from "@/lib/debts";
import { formatCurrency } from "@/lib/format";
import DebtRow from "./DebtRow";

export default function DebtsList() {
  const { accounts, transactions } = useHorizonStore();
  const rows = listDebts(accounts, transactions);
  const summary = summarizeDebts(rows);

  if (rows.length === 0) {
    return (
      <div className="space-y-4">
        <div className="rounded-2xl bg-card p-6 text-center text-fg/65">
          <p className="text-base font-semibold text-fg/85">No debts tracked</p>
          <p className="mt-1 text-sm">
            Credit cards and loans you add will appear here so you can see
            balances, interest rates, and minimum payments at a glance.
          </p>
        </div>
        <Link
          href="/accounts/new"
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-card-elevated px-5 py-4 text-base font-bold text-accent"
        >
          <PlusCircle size={20} strokeWidth={2.4} />
          Add a debt account
        </Link>
      </div>
    );
  }

  const aprText =
    summary.weightedApr === null
      ? "—"
      : `${summary.weightedApr.toFixed(2)}%`;

  return (
    <div className="space-y-4">
      <section className="rounded-2xl bg-card p-5">
        <p className="text-xs font-medium uppercase tracking-wide text-fg/60">
          Total Owed
        </p>
        <p className="mt-1 text-3xl font-extrabold tabular-nums text-rose-400">
          {formatCurrency(summary.totalBalance)}
        </p>
        <dl className="mt-3 grid grid-cols-3 gap-3 text-sm">
          <div>
            <dt className="text-xs text-fg/55">Debts</dt>
            <dd className="mt-0.5 font-semibold tabular-nums">
              {summary.count}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-fg/55">Avg APR</dt>
            <dd
              className={`mt-0.5 font-semibold tabular-nums ${
                summary.weightedApr === null ? "text-fg/40" : ""
              }`}
            >
              {aprText}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-fg/55">Monthly Min</dt>
            <dd className="mt-0.5 font-semibold tabular-nums">
              {formatCurrency(summary.totalMinimumPayment)}
            </dd>
          </div>
        </dl>
      </section>

      <ul className="flex flex-col gap-2">
        {rows.map((row) => (
          <li key={row.account.id}>
            <DebtRow row={row} />
          </li>
        ))}
      </ul>

      <p className="px-2 text-xs text-fg/50">
        Tap a debt to set its APR or monthly minimum.
      </p>
    </div>
  );
}
