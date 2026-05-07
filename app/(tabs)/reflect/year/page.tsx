"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import SubpageHeader from "@/components/layout/SubpageHeader";
import { useHorizonStore } from "@/components/store/HorizonStore";
import {
  incomeVsSpending,
  rangeTotals,
  spendingBreakdownForMonth,
  topSpendingPayees,
} from "@/lib/reflect";
import { formatCurrency } from "@/lib/format";

const yearFmt = new Intl.NumberFormat("en-US", { useGrouping: false });

export default function YearSummaryPage() {
  const { transactions, groups } = useHorizonStore();
  const now = new Date();
  // Default to "the last completed calendar year" so January users see a
  // meaningful page on their first visit.
  const [year, setYear] = useState<number>(() =>
    now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear(),
  );
  const isCurrentYear = year === now.getFullYear();
  const lastMonth = isCurrentYear ? now.getMonth() : 11;

  const totals = useMemo(
    () => rangeTotals(transactions, year, lastMonth, lastMonth + 1),
    [transactions, year, lastMonth],
  );
  const monthly = useMemo(
    () => incomeVsSpending(transactions, year, lastMonth, lastMonth + 1),
    [transactions, year, lastMonth],
  );

  // Aggregate spending per category across the full year by summing each
  // month's per-category breakdown — small enough to be cheap.
  const categoryYearSpend = useMemo(() => {
    const totals = new Map<string, number>();
    for (let m = 0; m <= lastMonth; m++) {
      const breakdown = spendingBreakdownForMonth(transactions, groups, year, m);
      for (const c of breakdown.categories) {
        totals.set(c.name, (totals.get(c.name) ?? 0) + c.spent);
      }
    }
    return Array.from(totals.entries())
      .map(([name, spent]) => ({ name, spent }))
      .sort((a, b) => b.spent - a.spent);
  }, [transactions, groups, year, lastMonth]);

  const topPayees = useMemo(
    () =>
      topSpendingPayees(transactions, year, lastMonth, lastMonth + 1)
        .entries.slice(0, 5),
    [transactions, year, lastMonth],
  );

  // Best & worst months by net (income - spending).
  const bestMonth = monthly.reduce<typeof monthly[number] | null>(
    (best, p) =>
      best === null || p.income - p.spending > best.income - best.spending
        ? p
        : best,
    null,
  );
  const worstMonth = monthly.reduce<typeof monthly[number] | null>(
    (worst, p) =>
      worst === null || p.income - p.spending < worst.income - worst.spending
        ? p
        : worst,
    null,
  );
  const avgIncome =
    monthly.length > 0
      ? monthly.reduce((s, p) => s + p.income, 0) / monthly.length
      : 0;
  const avgSpending =
    monthly.length > 0
      ? monthly.reduce((s, p) => s + p.spending, 0) / monthly.length
      : 0;

  const hasData = totals.income > 0 || totals.spending > 0;

  return (
    <>
      <SubpageHeader title="Year Summary" backHref="/reflect" />
      <div className="px-4 pt-2 pb-10 space-y-3">
        <div className="flex items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => setYear((y) => y - 1)}
            aria-label="Previous year"
            className="grid h-9 w-9 place-items-center rounded-full bg-card-elevated"
          >
            <ChevronLeft size={18} strokeWidth={2.5} />
          </button>
          <span className="min-w-[5rem] text-center text-2xl font-extrabold tabular-nums">
            {yearFmt.format(year)}
          </span>
          <button
            type="button"
            onClick={() => setYear((y) => y + 1)}
            disabled={year >= now.getFullYear()}
            aria-label="Next year"
            className="grid h-9 w-9 place-items-center rounded-full bg-card-elevated disabled:opacity-30"
          >
            <ChevronRight size={18} strokeWidth={2.5} />
          </button>
        </div>
        {isCurrentYear && (
          <p className="text-center text-[11px] text-fg/45">
            Year-to-date through {monthName(lastMonth)}
          </p>
        )}

        {!hasData ? (
          <div className="rounded-2xl bg-card px-5 py-12 text-center text-sm text-fg/55">
            No income or spending recorded for this year.
          </div>
        ) : (
          <>
            <div className="rounded-2xl bg-card p-5">
              <p className="text-xs font-medium uppercase tracking-wide text-fg/55">
                Net for the year
              </p>
              <p
                className={`mt-1 text-4xl font-extrabold tabular-nums ${
                  totals.net < 0 ? "text-rose-400" : "text-emerald-400"
                }`}
              >
                {totals.net < 0 ? "−" : "+"}
                {formatCurrency(Math.abs(totals.net))}
              </p>
              <p className="mt-1 text-xs text-fg/55">
                Saved{" "}
                <span className="font-bold text-fg/80">
                  {Math.round(totals.savingsRate * 100)}%
                </span>{" "}
                of income.
              </p>
              <dl className="mt-4 grid grid-cols-2 gap-y-1.5 text-sm">
                <dt className="text-fg/55">Income</dt>
                <dd className="text-right font-semibold tabular-nums text-emerald-400">
                  {formatCurrency(totals.income)}
                </dd>
                <dt className="text-fg/55">Spending</dt>
                <dd className="text-right font-semibold tabular-nums text-rose-300">
                  {formatCurrency(totals.spending)}
                </dd>
                <dt className="text-fg/55">Avg / month income</dt>
                <dd className="text-right font-semibold tabular-nums">
                  {formatCurrency(avgIncome)}
                </dd>
                <dt className="text-fg/55">Avg / month spending</dt>
                <dd className="text-right font-semibold tabular-nums">
                  {formatCurrency(avgSpending)}
                </dd>
              </dl>
            </div>

            {(bestMonth || worstMonth) && (
              <div className="rounded-2xl bg-card p-5">
                <p className="text-xs font-medium uppercase tracking-wide text-fg/55">
                  Standout months
                </p>
                <dl className="mt-2 grid grid-cols-2 gap-y-1.5 text-sm">
                  {bestMonth && (
                    <>
                      <dt className="text-emerald-400 font-semibold">
                        Best · {bestMonth.month}
                      </dt>
                      <dd className="text-right font-semibold tabular-nums text-emerald-400">
                        +{formatCurrency(bestMonth.income - bestMonth.spending)}
                      </dd>
                    </>
                  )}
                  {worstMonth && bestMonth?.month !== worstMonth.month && (
                    <>
                      <dt className="text-rose-300 font-semibold">
                        Tightest · {worstMonth.month}
                      </dt>
                      <dd className="text-right font-semibold tabular-nums text-rose-300">
                        {worstMonth.income - worstMonth.spending < 0 ? "−" : "+"}
                        {formatCurrency(
                          Math.abs(worstMonth.income - worstMonth.spending),
                        )}
                      </dd>
                    </>
                  )}
                </dl>
              </div>
            )}

            {categoryYearSpend.length > 0 && (
              <div className="rounded-2xl bg-card overflow-hidden">
                <p className="px-5 pt-4 text-xs font-medium uppercase tracking-wide text-fg/55">
                  Top categories
                </p>
                <ul className="mt-2 divide-y divide-fg/5">
                  {categoryYearSpend.slice(0, 8).map((c) => (
                    <li
                      key={c.name}
                      className="flex items-center justify-between px-5 py-2.5 text-sm"
                    >
                      <span className="truncate">{c.name}</span>
                      <span className="font-semibold tabular-nums">
                        {formatCurrency(c.spent)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {topPayees.length > 0 && (
              <div className="rounded-2xl bg-card overflow-hidden">
                <p className="px-5 pt-4 text-xs font-medium uppercase tracking-wide text-fg/55">
                  Top payees
                </p>
                <ul className="mt-2 divide-y divide-fg/5">
                  {topPayees.map((p) => (
                    <li
                      key={p.payee}
                      className="flex items-center justify-between px-5 py-2.5 text-sm"
                    >
                      <span className="truncate">{p.payee}</span>
                      <span className="font-semibold tabular-nums">
                        {formatCurrency(p.total)}
                      </span>
                    </li>
                  ))}
                </ul>
                <Link
                  href={`/reflect/payees?range=12`}
                  className="block border-t border-fg/5 px-5 py-2.5 text-center text-xs font-bold text-accent"
                >
                  See full Payees report
                </Link>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}

const monthFmt = new Intl.DateTimeFormat("en-US", { month: "long" });
function monthName(idx: number): string {
  return monthFmt.format(new Date(2000, idx, 1));
}
