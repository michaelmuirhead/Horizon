"use client";

import { PieChart } from "lucide-react";
import ReportCard from "./ReportCard";
import { formatCurrency } from "@/lib/format";
import { useHorizonStore } from "@/components/store/HorizonStore";
import { trackingAccountNames } from "@/lib/accounts";
import { spendingBreakdownForMonth } from "@/lib/reflect";

const TOP_N = 5;

export default function SpendingBreakdownCard() {
  const { transactions, accounts, groups } = useHorizonStore();
  const trackingNames = trackingAccountNames(accounts);
  const budgetTxs = transactions.filter((t) => !trackingNames.has(t.account));
  const now = new Date();
  const { month, total, categories } = spendingBreakdownForMonth(
    budgetTxs,
    groups,
    now.getFullYear(),
    now.getMonth(),
  );
  const top = categories.slice(0, TOP_N);

  return (
    <ReportCard
      title="Spending Breakdown"
      Icon={PieChart}
      href="/reflect/spending-breakdown"
    >
      <p className="text-sm text-fg/70">{month}</p>
      <p className="mt-1 text-3xl font-extrabold tabular-nums">
        {formatCurrency(total)}
      </p>

      <div className="mt-4 h-3 overflow-hidden rounded-full bg-card-elevated">
        <div
          className="h-full bg-accent"
          style={{ width: total > 0 ? "100%" : "0%" }}
        />
      </div>

      {top.length === 0 ? (
        <p className="mt-5 text-sm text-fg/60">
          No spending recorded this month yet.
        </p>
      ) : (
        <>
          <div className="mt-5 flex justify-between text-sm text-fg/70">
            <span>Top Categories</span>
            <span>Spent</span>
          </div>
          <ul className="mt-2 space-y-2">
            {top.map((c) => (
              <li
                key={c.name}
                className="flex items-center justify-between text-base font-semibold"
              >
                <span className="flex items-center gap-2">
                  <span className="inline-block h-3 w-1 rounded-full bg-accent" />
                  {c.name}
                </span>
                <span className="tabular-nums">{formatCurrency(c.spent)}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </ReportCard>
  );
}
