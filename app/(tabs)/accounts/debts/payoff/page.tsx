"use client";

import { useMemo, useState } from "react";
import { Calculator, ChevronRight, TrendingDown } from "lucide-react";
import SubpageHeader from "@/components/layout/SubpageHeader";
import { useHorizonStore } from "@/components/store/HorizonStore";
import { listDebts } from "@/lib/debts";
import {
  compareStrategies,
  type PayoffDebt,
  type PayoffResult,
  type PayoffStrategy,
} from "@/lib/debtPayoff";
import { formatCurrency } from "@/lib/format";

function monthsToText(m: number): string {
  if (m === 0) return "Already paid off";
  const years = Math.floor(m / 12);
  const remMonths = m % 12;
  if (years === 0) return `${m} ${m === 1 ? "month" : "months"}`;
  if (remMonths === 0) return `${years} ${years === 1 ? "year" : "years"}`;
  return `${years}y ${remMonths}mo`;
}

export default function DebtPayoffPage() {
  const { accounts, transactions } = useHorizonStore();
  const rows = listDebts(accounts, transactions);
  const [strategy, setStrategy] = useState<PayoffStrategy>("avalanche");
  const [extraText, setExtraText] = useState("0");

  // Build the simulator's input. Skip rows missing APR or min payment —
  // we can't honestly project a payoff date without both, and we don't
  // want to silently substitute zeros.
  const { debts, skipped } = useMemo(() => {
    const usable: PayoffDebt[] = [];
    const left: typeof rows = [];
    for (const r of rows) {
      if (r.balance <= 0) continue;
      if (r.apr === null || r.minimumPayment === null) {
        left.push(r);
        continue;
      }
      usable.push({
        id: r.account.id,
        name: r.account.name,
        balance: r.balance,
        aprPercent: r.apr,
        minPayment: r.minimumPayment,
      });
    }
    return { debts: usable, skipped: left };
  }, [rows]);

  const extra = useMemo(() => {
    const n = parseFloat(extraText);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  }, [extraText]);

  const compared = useMemo(
    () => (debts.length === 0 ? null : compareStrategies(debts, extra)),
    [debts, extra],
  );
  const selected: PayoffResult | null = compared
    ? compared[strategy]
    : null;
  const other: PayoffResult | null = compared
    ? compared[strategy === "snowball" ? "avalanche" : "snowball"]
    : null;
  const savings =
    compared && other && !selected!.diverged && !other.diverged
      ? other.totalInterest - selected!.totalInterest
      : 0;

  return (
    <>
      <SubpageHeader title="Payoff plan" backHref="/accounts/debts" />
      <div className="px-4 pt-2 pb-10 space-y-5">
        <p className="text-sm text-fg/65">
          Compare snowball (smallest balance first) and avalanche (highest
          APR first) for the debts you&rsquo;re tracking. Add an extra
          monthly amount to see how much sooner you&rsquo;d be done.
        </p>

        <section className="rounded-2xl bg-card p-4 space-y-3">
          <label className="flex flex-col gap-1">
            <span className="text-xs text-fg/55">Extra monthly payment</span>
            <div className="flex items-center gap-1 rounded-xl bg-card-elevated px-3 py-2">
              <span className="text-fg/60">$</span>
              <input
                type="number"
                inputMode="decimal"
                step="10"
                min="0"
                value={extraText}
                onChange={(e) => setExtraText(e.target.value)}
                className="w-full bg-transparent text-base font-semibold text-fg outline-none placeholder:text-fg/40 tabular-nums"
              />
            </div>
          </label>
          <div className="flex gap-2">
            {(["avalanche", "snowball"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStrategy(s)}
                className={`flex-1 rounded-full px-3 py-2 text-sm font-bold ${
                  strategy === s
                    ? "bg-accent text-page"
                    : "bg-card-elevated text-fg/70"
                }`}
              >
                {s === "avalanche" ? "Avalanche" : "Snowball"}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-fg/55">
            {strategy === "avalanche"
              ? "Highest APR first — minimizes total interest paid."
              : "Smallest balance first — quickest visible wins."}
          </p>
        </section>

        {compared === null ? (
          <div className="rounded-2xl bg-card p-6 text-center text-fg/65">
            <Calculator
              size={20}
              strokeWidth={2.2}
              className="mx-auto text-accent"
            />
            <p className="mt-2 text-base font-semibold text-fg/85">
              Need at least one debt with an APR and minimum payment
            </p>
            <p className="mt-1 text-sm">
              Open a debt account and fill in those fields to run the
              simulation.
            </p>
          </div>
        ) : (
          <>
            <section className="rounded-2xl bg-card p-5">
              <p className="text-xs font-medium uppercase tracking-wide text-fg/60">
                {strategy === "avalanche" ? "Avalanche" : "Snowball"} plan
              </p>
              {selected!.diverged ? (
                <p className="mt-2 text-rose-300 text-sm font-semibold">
                  Minimums don&rsquo;t cover monthly interest. Increase the
                  extra payment or raise minimums to make progress.
                </p>
              ) : (
                <>
                  <p className="mt-1 text-3xl font-extrabold tabular-nums">
                    {monthsToText(selected!.monthsToPayoff)}
                  </p>
                  <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <dt className="text-xs text-fg/55">Total interest</dt>
                      <dd className="mt-0.5 font-semibold tabular-nums text-rose-300">
                        {formatCurrency(selected!.totalInterest)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-fg/55">Total paid</dt>
                      <dd className="mt-0.5 font-semibold tabular-nums">
                        {formatCurrency(selected!.totalPaid)}
                      </dd>
                    </div>
                  </dl>
                  {savings > 0 && (
                    <p className="mt-3 flex items-center gap-2 rounded-xl bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-300">
                      <TrendingDown size={14} strokeWidth={2.4} />
                      Saves {formatCurrency(savings)} vs{" "}
                      {strategy === "avalanche" ? "snowball" : "avalanche"}.
                    </p>
                  )}
                  {savings < 0 && (
                    <p className="mt-3 text-xs text-fg/55">
                      {strategy === "avalanche" ? "Snowball" : "Avalanche"}{" "}
                      finishes {formatCurrency(-savings)} cheaper in this
                      scenario.
                    </p>
                  )}
                </>
              )}
            </section>

            <section className="space-y-2">
              <h2 className="px-1 text-xs font-bold uppercase tracking-wide text-fg/55">
                Per-debt payoff order
              </h2>
              <ul className="flex flex-col gap-2">
                {Object.entries(selected!.perDebt)
                  .sort((a, b) => {
                    const am = a[1].paidOffMonth ?? Number.MAX_SAFE_INTEGER;
                    const bm = b[1].paidOffMonth ?? Number.MAX_SAFE_INTEGER;
                    return am - bm;
                  })
                  .map(([id, info]) => {
                    const debt = debts.find((d) => d.id === id);
                    if (!debt) return null;
                    return (
                      <li
                        key={id}
                        className="flex items-center gap-3 rounded-2xl bg-card-elevated px-3 py-3"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="truncate text-base font-bold">
                            {debt.name}
                          </p>
                          <p className="mt-0.5 text-xs text-fg/55 tabular-nums">
                            {formatCurrency(debt.balance)} @{" "}
                            {debt.aprPercent.toFixed(2)}%
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-xs text-fg/55">Paid off</p>
                          <p className="text-base font-bold tabular-nums">
                            {info.paidOffMonth === null
                              ? "—"
                              : monthsToText(info.paidOffMonth)}
                          </p>
                        </div>
                        <ChevronRight
                          size={14}
                          className="text-fg/40 shrink-0"
                        />
                      </li>
                    );
                  })}
              </ul>
            </section>
          </>
        )}

        {skipped.length > 0 && (
          <p className="text-[11px] text-fg/55">
            Skipped {skipped.length}{" "}
            {skipped.length === 1 ? "debt" : "debts"} missing an APR or
            minimum payment.
          </p>
        )}
      </div>
    </>
  );
}
