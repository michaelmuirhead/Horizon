"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import SubpageHeader from "@/components/layout/SubpageHeader";
import Segmented from "@/components/reflect/Segmented";
import { useHorizonStore } from "@/components/store/HorizonStore";
import { trackingAccountNames } from "@/lib/accounts";
import { topSpendingPayees } from "@/lib/reflect";
import { formatCurrency } from "@/lib/format";

type Range = "3" | "6" | "12";
const VALID_RANGES: Range[] = ["3", "6", "12"];

export default function TopPayeesPage() {
  return (
    <Suspense fallback={null}>
      <TopPayees />
    </Suspense>
  );
}

function TopPayees() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initial = searchParams.get("range");
  const startRange: Range = VALID_RANGES.includes(initial as Range)
    ? (initial as Range)
    : "6";
  const { transactions, accounts } = useHorizonStore();
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
  const { months, entries } = topSpendingPayees(
    budgetTxs,
    now.getFullYear(),
    now.getMonth(),
    monthsBack,
  );
  const total = entries.reduce((s, e) => s + e.total, 0);
  const peak = entries.reduce((max, e) => Math.max(max, ...e.byMonth), 0);

  return (
    <>
      <SubpageHeader title="Top Payees" backHref="/reflect" />
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

        <div className="mt-4 rounded-2xl bg-card p-5 text-center">
          <p className="text-xs font-medium uppercase tracking-wide text-fg/60">
            Total spent
          </p>
          <p className="mt-1 text-3xl font-extrabold tabular-nums">
            {formatCurrency(total)}
          </p>
          <p className="mt-1 text-xs text-fg/55">
            across {entries.length}{" "}
            {entries.length === 1 ? "payee" : "payees"} over {monthsBack}{" "}
            months
          </p>
        </div>

        {entries.length === 0 ? (
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
            {entries.map((e) => {
              const pct = total > 0 ? Math.round((e.total / total) * 100) : 0;
              return (
                <li key={e.payee} className="rounded-2xl bg-card p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-base font-bold truncate">
                      {e.payee}
                    </span>
                    <span className="text-base font-bold tabular-nums">
                      {formatCurrency(e.total)}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/10">
                      <div
                        className="h-full bg-accent"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-xs font-bold tabular-nums text-fg/70">
                      {pct}%
                    </span>
                  </div>
                  <div
                    className="mt-3 grid items-end gap-1"
                    style={{
                      gridTemplateColumns: `repeat(${months.length}, minmax(0, 1fr))`,
                      height: 36,
                    }}
                    aria-hidden
                  >
                    {e.byMonth.map((v, i) => {
                      const h = peak > 0 ? Math.max(2, (v / peak) * 36) : 2;
                      return (
                        <div
                          key={i}
                          className="self-end rounded-sm bg-accent"
                          style={{
                            height: `${h}px`,
                            opacity: v > 0 ? 0.85 : 0.15,
                          }}
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
              );
            })}
          </ul>
        )}
      </div>
    </>
  );
}
