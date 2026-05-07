"use client";

import { useState } from "react";
import SubpageHeader from "@/components/layout/SubpageHeader";
import CashFlowChart from "@/components/charts/CashFlowChart";
import Segmented from "@/components/reflect/Segmented";
import { useHorizonStore } from "@/components/store/HorizonStore";
import { projectCashFlow } from "@/lib/cashflow";
import { todayIso } from "@/lib/scheduled";
import { formatCurrency } from "@/lib/format";

type Horizon = "14" | "30" | "60" | "90";

const longDateFmt = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
});

function parseIsoDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function formatLong(iso: string): string {
  return longDateFmt.format(parseIsoDate(iso));
}

export default function CashFlowProjectionPage() {
  const { accounts, transactions, scheduledTransactions } = useHorizonStore();
  const [horizon, setHorizon] = useState<Horizon>("30");
  const days = parseInt(horizon, 10);

  const today = todayIso();
  const projection = projectCashFlow(
    accounts,
    transactions,
    scheduledTransactions,
    days,
    today,
  );
  const change = projection.end - projection.start;
  const dipsBelowZero = projection.low.balance < 0;
  const dipsBelowStart = projection.low.balance < projection.start;

  return (
    <>
      <SubpageHeader title="Cash Flow Projection" backHref="/reflect" />
      <div className="px-4 pt-2 pb-10 space-y-3">
        <div className="flex justify-end">
          <Segmented
            value={horizon}
            onChange={setHorizon}
            options={[
              { value: "14", label: "14d" },
              { value: "30", label: "30d" },
              { value: "60", label: "60d" },
              { value: "90", label: "90d" },
            ]}
          />
        </div>

        <div className="rounded-2xl bg-card p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-fg/55">
            Liquid balance in {days} days
          </p>
          <p
            className={`mt-1 text-4xl font-extrabold tabular-nums ${
              projection.end < 0 ? "text-rose-400" : "text-fg"
            }`}
          >
            {formatCurrency(projection.end)}
          </p>
          <p
            className={`mt-1 text-sm font-semibold tabular-nums ${
              change < 0 ? "text-rose-300" : "text-emerald-400"
            }`}
          >
            {change >= 0 ? "+" : "−"}
            {formatCurrency(Math.abs(change))} from today
          </p>

          <div className="mt-4">
            <CashFlowChart data={projection.series} />
          </div>

          <dl className="mt-4 grid grid-cols-2 gap-y-1.5 text-sm">
            <dt className="text-fg/55">Today</dt>
            <dd className="text-right font-semibold tabular-nums">
              {formatCurrency(projection.start)}
            </dd>
            <dt className="text-fg/55">Lowest point</dt>
            <dd
              className={`text-right font-semibold tabular-nums ${
                projection.low.balance < 0 ? "text-rose-400" : ""
              }`}
            >
              {formatCurrency(projection.low.balance)}
            </dd>
            <dt className="text-fg/55">…on</dt>
            <dd className="text-right font-semibold tabular-nums">
              {formatLong(projection.low.date)}
            </dd>
          </dl>
        </div>

        {dipsBelowZero ? (
          <div className="rounded-2xl bg-rose-900/30 px-4 py-3 text-sm text-rose-200">
            Your liquid balance is projected to go negative on{" "}
            <span className="font-bold">{formatLong(projection.low.date)}</span>
            . Consider rescheduling something or moving funds.
          </div>
        ) : dipsBelowStart ? (
          <div className="rounded-2xl bg-amber-900/25 px-4 py-3 text-sm text-amber-200">
            You&rsquo;ll dip to{" "}
            <span className="font-bold">{formatCurrency(projection.low.balance)}</span>{" "}
            on{" "}
            <span className="font-bold">{formatLong(projection.low.date)}</span>
            .
          </div>
        ) : (
          <div className="rounded-2xl bg-emerald-900/25 px-4 py-3 text-sm text-emerald-200">
            Steady — no dip below today&rsquo;s liquid balance in this window.
          </div>
        )}

        <p className="px-2 text-[11px] text-fg/45">
          Based on liquid asset accounts (cash, checking, savings) and your
          scheduled transactions only. Day-to-day spending isn&rsquo;t
          forecast.
        </p>
      </div>
    </>
  );
}
