"use client";

import Link from "next/link";
import { Wallet } from "lucide-react";
import type { Account } from "@/lib/accounts";
import {
  amortizationSchedule,
  monthlyPayment,
  totalInterestOverLife,
} from "@/lib/loans";
import { formatCurrency } from "@/lib/format";

export default function LoanSummaryCard({ account }: { account: Account }) {
  if (account.type !== "loan") return null;

  const apr = account.loanApr ?? 0;
  const term = account.loanTermMonths ?? 0;
  const principal =
    account.loanOriginalPrincipal ?? Math.abs(account.balance);

  const payHref = `/spending/loan-payment?loan=${encodeURIComponent(account.id)}`;

  if (apr === 0 && term === 0) {
    return (
      <div className="rounded-2xl bg-card p-5 text-sm text-fg/60">
        Add an APR and term to see this loan&rsquo;s amortization.
      </div>
    );
  }

  const payment = monthlyPayment(principal, apr, term);
  const interest = totalInterestOverLife(principal, apr, term);
  const schedule = amortizationSchedule(principal, apr, term, 12);

  return (
    <div className="space-y-3">
      <div className="rounded-2xl bg-card p-5">
        <p className="text-xs font-medium uppercase tracking-wide text-fg/60">
          Loan Summary
        </p>
        <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5 text-sm">
          <dt className="text-fg/55">Original Principal</dt>
          <dd className="text-right font-semibold tabular-nums">
            {formatCurrency(principal)}
          </dd>
          <dt className="text-fg/55">APR</dt>
          <dd className="text-right font-semibold tabular-nums">
            {apr.toFixed(2)}%
          </dd>
          <dt className="text-fg/55">Term</dt>
          <dd className="text-right font-semibold tabular-nums">
            {term} months
          </dd>
          <dt className="text-fg/55">Estimated Monthly</dt>
          <dd className="text-right font-semibold tabular-nums">
            {formatCurrency(payment)}
          </dd>
          <dt className="text-fg/55">Total Interest</dt>
          <dd className="text-right font-semibold tabular-nums text-rose-400">
            {formatCurrency(interest)}
          </dd>
        </dl>
        <Link
          href={payHref}
          className="mt-4 flex items-center justify-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-bold text-fg"
        >
          <Wallet size={16} strokeWidth={2.4} />
          Make a payment
        </Link>
      </div>

      {schedule.length > 0 && (
        <div className="overflow-hidden rounded-2xl bg-card">
          <p className="px-4 pt-3 text-xs font-medium uppercase tracking-wide text-fg/60">
            Next {schedule.length} Payments
          </p>
          <table className="mt-1 w-full text-xs">
            <thead className="text-fg/55">
              <tr>
                <th className="px-3 py-2 text-left font-medium">#</th>
                <th className="px-3 py-2 text-right font-medium">Principal</th>
                <th className="px-3 py-2 text-right font-medium">Interest</th>
                <th className="px-3 py-2 text-right font-medium">Balance</th>
              </tr>
            </thead>
            <tbody>
              {schedule.map((s) => (
                <tr key={s.index} className="border-t border-fg/5">
                  <td className="px-3 py-1.5 text-fg/65">{s.index}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">
                    {formatCurrency(s.principal)}
                  </td>
                  <td className="px-3 py-1.5 text-right tabular-nums text-rose-300/80">
                    {formatCurrency(s.interest)}
                  </td>
                  <td className="px-3 py-1.5 text-right tabular-nums text-fg/85">
                    {formatCurrency(s.balance)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
