"use client";

import { useState } from "react";
import SubpageHeader from "@/components/layout/SubpageHeader";
import CashFlowChart from "@/components/charts/CashFlowChart";
import Segmented from "@/components/reflect/Segmented";
import { useHorizonStore } from "@/components/store/HorizonStore";
import { baselineDailyDrift, projectCashFlow } from "@/lib/cashflow";
import { todayIso } from "@/lib/scheduled";
import { formatCurrency } from "@/lib/format";

type Horizon = "30" | "90" | "180" | "365";

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
  // Only layer in the baseline drift on long horizons. Inside ~60 days
  // the schedule + RTA assumptions dominate and adding drift overstates
  // discretionary noise; past that, a flat line is unrealistic.
  const baseline =
    days > 60
      ? baselineDailyDrift(accounts, transactions, scheduledTransactions, today)
      : null;
  const driftToApply = baseline?.hasEnoughData ? baseline.drift : 0;
  const projection = projectCashFlow(
    accounts,
    transactions,
    scheduledTransactions,
    days,
    today,
    driftToApply,
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
              { value: "30", label: "30d" },
              { value: "90", label: "90d" },
              { value: "180", label: "6mo" },
              { value: "365", label: "1y" },
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

        {baseline && !baseline.hasEnoughData && (
          <div className="rounded-2xl bg-amber-900/25 px-4 py-3 text-sm text-amber-200">
            <p className="font-semibold">
              Sparse history — baseline drift omitted.
            </p>
            <p className="mt-1 text-xs text-amber-200/85">
              {baseline.daysOfHistory === 0 ? (
                <>
                  No non-scheduled activity in the last 90 days, so the line
                  past 60 days reflects scheduled events only. Real life
                  spending will pull it lower.
                </>
              ) : (
                <>
                  Only {baseline.daysOfHistory}{" "}
                  {baseline.daysOfHistory === 1 ? "day" : "days"} of history
                  ({baseline.txCount}{" "}
                  {baseline.txCount === 1 ? "transaction" : "transactions"})
                  &mdash; not enough to reliably extrapolate{" "}
                  {Math.round(days / 30)} months out. The line past 60 days
                  reflects scheduled events only.
                </>
              )}
            </p>
          </div>
        )}

        <p className="px-2 text-[11px] text-fg/45">
          Based on liquid asset accounts (cash, checking, savings) and your
          scheduled transactions.
          {baseline?.hasEnoughData && (
            <>
              {" "}
              Layered with a baseline of{" "}
              <span className="font-semibold tabular-nums">
                {formatCurrency(baseline.drift)}
              </span>
              /day from {baseline.daysOfHistory} days of non-scheduled
              activity ({baseline.txCount} transactions).
            </>
          )}
        </p>
      </div>
    </>
  );
}
