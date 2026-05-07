"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import SubpageHeader from "@/components/layout/SubpageHeader";
import Segmented from "@/components/reflect/Segmented";
import { useHorizonStore } from "@/components/store/HorizonStore";
import { trackingAccountNames } from "@/lib/accounts";
import { categorySpendingTrends } from "@/lib/reflect";
import { formatCurrency } from "@/lib/format";

type Range = "3" | "6" | "12";
const VALID_RANGES: Range[] = ["3", "6", "12"];

export default function SpendingTrendsPage() {
  return (
    <Suspense fallback={null}>
      <SpendingTrends />
    </Suspense>
  );
}

function SpendingTrends() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initial = searchParams.get("range");
  const startRange: Range = VALID_RANGES.includes(initial as Range)
    ? (initial as Range)
    : "6";
  const { transactions, accounts, groups } = useHorizonStore();
  const [range, setRange] = useState<Range>(startRange);

  function changeRange(next: Range) {
    setRange(next);
    const sp = new URLSearchParams(searchParams.toString());
    sp.set("range", next);
    router.replace(`?${sp.toString()}`);
  }
  const monthsBack = parseInt(range, 10);

  const trackingNames = trackingAccountNames(accounts);
  const budgetTxs = transactions.filter((t) => !trackingNames.has(t.account));
  const now = new Date();
  const { months, trends } = categorySpendingTrends(
    budgetTxs,
    groups,
    now.getFullYear(),
    now.getMonth(),
    monthsBack,
  );
  const peak = trends.reduce(
    (max, t) => Math.max(max, ...t.byMonth),
    0,
  );

  return (
    <>
      <SubpageHeader title="Spending Trends" backHref="/reflect" />
      <div className="px-4 pt-2 pb-10">
        <Segmented
          value={range}
          onChange={changeRange}
          options={[
            { value: "3", label: "3M" },
            { value: "6", label: "6M" },
            { value: "12", label: "12M" },
          ]}
        />

        {trends.length === 0 ? (
          <div className="mt-6 flex flex-col items-center gap-3 text-center text-fg/60">
            <p className="text-base">
              No outflow activity in the last {monthsBack} months.
            </p>
            <Link
              href="/spending/new"
              className="text-sm font-bold text-accent"
            >
              Log a transaction
            </Link>
          </div>
        ) : (
          <ul className="mt-4 flex flex-col gap-3">
            {trends.map((t) => (
              <li key={t.name} className="rounded-2xl bg-card p-4">
                <div className="flex items-center justify-between">
                  <span className="text-base font-bold truncate">{t.name}</span>
                  <span className="text-base font-bold tabular-nums">
                    {formatCurrency(t.total)}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-fg/55">
                  {formatCurrency(t.total / monthsBack)}/mo avg over{" "}
                  {monthsBack} months
                </p>
                <div
                  className="mt-3 grid items-end gap-1"
                  style={{
                    gridTemplateColumns: `repeat(${months.length}, minmax(0, 1fr))`,
                    height: 48,
                  }}
                  aria-hidden
                >
                  {t.byMonth.map((v, i) => {
                    const h = peak > 0 ? Math.max(2, (v / peak) * 48) : 2;
                    return (
                      <div
                        key={i}
                        className="self-end rounded-sm bg-accent"
                        style={{ height: `${h}px`, opacity: v > 0 ? 0.85 : 0.15 }}
                        title={`${months[i]}: ${formatCurrency(v)}`}
                      />
                    );
                  })}
                </div>
                <div
                  className="mt-1 grid text-[10px] text-fg/45"
                  style={{
                    gridTemplateColumns: `repeat(${months.length}, minmax(0, 1fr))`,
                  }}
                >
                  {months.map((m) => (
                    <span key={m} className="text-center">
                      {m}
                    </span>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
