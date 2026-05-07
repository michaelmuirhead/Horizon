"use client";

import { BarChart3 } from "lucide-react";
import ReportCard from "./ReportCard";
import IncomeSpendingChart from "@/components/charts/IncomeSpendingChart";
import Legend from "./Legend";
import { useHorizonStore } from "@/components/store/HorizonStore";
import { trackingAccountNames } from "@/lib/accounts";
import { incomeVsSpending, rangeTotals } from "@/lib/reflect";
import { formatCurrency } from "@/lib/format";

export default function IncomeVsSpendingCard({
  monthsBack = 6,
}: {
  monthsBack?: number;
} = {}) {
  const { transactions, accounts } = useHorizonStore();
  const trackingNames = trackingAccountNames(accounts);
  const budgetTxs = transactions.filter((t) => !trackingNames.has(t.account));
  const now = new Date();
  const data = incomeVsSpending(
    budgetTxs,
    now.getFullYear(),
    now.getMonth(),
    monthsBack,
  );
  const totals = rangeTotals(
    budgetTxs,
    now.getFullYear(),
    now.getMonth(),
    monthsBack,
  );
  const headline =
    totals.income === 0 && totals.spending === 0
      ? "Add some income to get started."
      : totals.spending > totals.income
        ? "So far, you’re spending more than you make."
        : totals.income > totals.spending
          ? "You’re spending less than you make."
          : "You’re breaking even.";
  const netToneClass =
    totals.net > 0
      ? "text-emerald-400"
      : totals.net < 0
        ? "text-rose-400"
        : "text-fg/70";
  const netArrow = totals.net > 0 ? "▲" : totals.net < 0 ? "▼" : "·";
  const savingsRatePct =
    totals.income > 0 ? Math.round(totals.savingsRate * 100) : null;

  return (
    <ReportCard title="Income vs. Spending" Icon={BarChart3}>
      <h3 className="text-2xl font-extrabold leading-snug">{headline}</h3>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-card-elevated px-3 py-2.5">
          <p className="text-[10px] font-bold uppercase tracking-wide text-fg/55">
            Net change
          </p>
          <p className={`mt-0.5 text-base font-extrabold tabular-nums ${netToneClass}`}>
            <span aria-hidden className="mr-1">
              {netArrow}
            </span>
            {formatCurrency(Math.abs(totals.net))}
          </p>
        </div>
        <div className="rounded-xl bg-card-elevated px-3 py-2.5">
          <p className="text-[10px] font-bold uppercase tracking-wide text-fg/55">
            Savings rate
          </p>
          <p className="mt-0.5 text-base font-extrabold tabular-nums">
            {savingsRatePct === null ? "—" : `${savingsRatePct}%`}
          </p>
        </div>
      </div>

      <div className="mt-4">
        <IncomeSpendingChart data={data} />
      </div>
      <Legend
        items={[
          { color: "#22c55e", label: "Income" },
          { color: "#6366f1", label: "Spending" },
        ]}
      />
    </ReportCard>
  );
}
