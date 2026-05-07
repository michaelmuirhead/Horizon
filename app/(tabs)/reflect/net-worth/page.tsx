"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import SubpageHeader from "@/components/layout/SubpageHeader";
import Segmented from "@/components/reflect/Segmented";
import NetWorthChart from "@/components/charts/NetWorthChart";
import { useHorizonStore } from "@/components/store/HorizonStore";
import {
  ASSET_ACCOUNT_TYPES,
  LIABILITY_ACCOUNT_TYPES,
  liveAccountBalance,
} from "@/lib/accounts";
import { currentNetWorth, netWorthHistory } from "@/lib/reflect";
import { formatCurrency } from "@/lib/format";

type Range = "6" | "12" | "24";
const VALID_RANGES: Range[] = ["6", "12", "24"];

export default function NetWorthPage() {
  return (
    <Suspense fallback={null}>
      <NetWorth />
    </Suspense>
  );
}

function NetWorth() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initial = searchParams.get("range");
  // Reflect's main tab uses 3/6/12; map 3 to 6 here so deep-links still work.
  const fromMain = initial && ["3", "6", "12"].includes(initial)
    ? (initial === "3" ? "6" : initial)
    : null;
  const startRange: Range = VALID_RANGES.includes(fromMain as Range)
    ? (fromMain as Range)
    : VALID_RANGES.includes(initial as Range)
      ? (initial as Range)
      : "12";
  const { accounts, transactions } = useHorizonStore();
  const [range, setRange] = useState<Range>(startRange);

  function changeRange(next: Range) {
    setRange(next);
    const sp = new URLSearchParams(searchParams.toString());
    sp.set("range", next);
    router.replace(`?${sp.toString()}`);
  }
  const monthsBack = parseInt(range, 10);

  const now = new Date();
  const current = currentNetWorth(accounts, transactions);
  const net = current.assets - current.debts;
  const history = netWorthHistory(
    accounts,
    transactions,
    now.getFullYear(),
    now.getMonth(),
    monthsBack,
  );
  const earliest = history[0];
  const change = earliest ? net - (earliest.assets - earliest.debts) : 0;

  const assetRows = accounts
    .filter((a) => ASSET_ACCOUNT_TYPES.has(a.type) && !a.closed)
    .map((a) => ({ a, balance: liveAccountBalance(a, transactions) }))
    .sort((a, b) => b.balance - a.balance);
  const liabilityRows = accounts
    .filter((a) => LIABILITY_ACCOUNT_TYPES.has(a.type) && !a.closed)
    .map((a) => ({ a, balance: liveAccountBalance(a, transactions) }))
    .sort((a, b) => a.balance - b.balance);

  return (
    <>
      <SubpageHeader title="Net Worth" backHref="/reflect" />
      <div className="px-4 pt-2 pb-10 space-y-4">
        <Segmented
          value={range}
          onChange={changeRange}
          options={[
            { value: "6", label: "6M" },
            { value: "12", label: "12M" },
            { value: "24", label: "24M" },
          ]}
        />

        <section className="rounded-3xl bg-card p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-fg/60">
            Current Net Worth
          </p>
          <p
            className={`mt-1 text-4xl font-extrabold tabular-nums ${
              net < 0 ? "text-rose-400" : "text-emerald-400"
            }`}
          >
            {formatCurrency(net)}
          </p>
          <p className="mt-1 text-xs text-fg/55">
            {change === 0
              ? "Unchanged over the range"
              : `${change > 0 ? "+" : ""}${formatCurrency(change)} over ${monthsBack} months`}
          </p>

          <div className="mt-4 space-y-1.5">
            <div className="flex justify-between text-sm font-semibold">
              <span className="text-accent">Assets</span>
              <span className="tabular-nums">
                {formatCurrency(current.assets)}
              </span>
            </div>
            <div className="flex justify-between text-sm font-semibold">
              <span className="text-rose-400">Debts</span>
              <span className="tabular-nums">
                {formatCurrency(current.debts)}
              </span>
            </div>
          </div>

          <div className="mt-4">
            <NetWorthChart
              data={history}
              currentIndex={history.length - 1}
              height={200}
            />
          </div>
        </section>

        {assetRows.length > 0 && (
          <section className="rounded-2xl bg-card p-5">
            <h2 className="text-base font-bold text-accent">Assets</h2>
            <ul className="mt-2 divide-y divide-fg/5">
              {assetRows.map(({ a, balance }) => (
                <li
                  key={a.id}
                  className="flex items-center justify-between py-2 text-sm"
                >
                  <span className="font-semibold">
                    {a.name}
                    {a.tracking && (
                      <span className="ml-2 rounded bg-white/10 px-1.5 py-0.5 text-[10px] uppercase text-fg/55">
                        Tracking
                      </span>
                    )}
                  </span>
                  <span className="tabular-nums text-emerald-400">
                    {formatCurrency(balance)}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {liabilityRows.length > 0 && (
          <section className="rounded-2xl bg-card p-5">
            <h2 className="text-base font-bold text-rose-400">Debts</h2>
            <ul className="mt-2 divide-y divide-fg/5">
              {liabilityRows.map(({ a, balance }) => (
                <li
                  key={a.id}
                  className="flex items-center justify-between py-2 text-sm"
                >
                  <span className="font-semibold">
                    {a.name}
                    {a.tracking && (
                      <span className="ml-2 rounded bg-white/10 px-1.5 py-0.5 text-[10px] uppercase text-fg/55">
                        Tracking
                      </span>
                    )}
                  </span>
                  <span className="tabular-nums text-rose-400">
                    {formatCurrency(balance)}
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
