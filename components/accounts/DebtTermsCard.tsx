"use client";

import { useEffect, useState } from "react";
import type { Account } from "@/lib/accounts";
import { useHorizonStore } from "@/components/store/HorizonStore";

function toInputValue(n: number | undefined): string {
  return typeof n === "number" ? String(n) : "";
}

function parseOptionalNumber(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  const parsed = parseFloat(trimmed);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

export default function DebtTermsCard({ account }: { account: Account }) {
  const { setAccountDebtTerms } = useHorizonStore();

  const initialApr =
    account.type === "loan"
      ? toInputValue(account.apr ?? account.loanApr)
      : toInputValue(account.apr);
  const [apr, setApr] = useState(initialApr);
  const [minPayment, setMinPayment] = useState(
    toInputValue(account.minimumPayment),
  );
  const [savedHint, setSavedHint] = useState(false);

  // If the account changes (e.g. switching detail pages), refresh inputs.
  useEffect(() => {
    setApr(initialApr);
    setMinPayment(toInputValue(account.minimumPayment));
    // initialApr is derived from account fields above and doesn't need to be
    // a dep itself.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account.id]);

  useEffect(() => {
    if (!savedHint) return;
    const t = setTimeout(() => setSavedHint(false), 1200);
    return () => clearTimeout(t);
  }, [savedHint]);

  function commit() {
    setAccountDebtTerms(account.id, {
      apr: parseOptionalNumber(apr),
      minimumPayment: parseOptionalNumber(minPayment),
    });
    setSavedHint(true);
  }

  const aprFieldId = `debt-apr-${account.id}`;
  const minFieldId = `debt-min-${account.id}`;

  return (
    <section className="rounded-2xl bg-card p-5">
      <div className="flex items-baseline justify-between">
        <p className="text-xs font-medium uppercase tracking-wide text-fg/60">
          Debt Terms
        </p>
        {savedHint && (
          <span className="text-xs font-semibold text-emerald-400">Saved</span>
        )}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <label htmlFor={aprFieldId} className="flex flex-col gap-1">
          <span className="text-xs text-fg/55">APR (%)</span>
          <input
            id={aprFieldId}
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0"
            placeholder="0.00"
            value={apr}
            onChange={(e) => setApr(e.target.value)}
            onBlur={commit}
            className="rounded-xl bg-card-elevated px-3 py-2 text-base font-semibold text-fg outline-none placeholder:text-fg/40 tabular-nums"
          />
        </label>
        <label htmlFor={minFieldId} className="flex flex-col gap-1">
          <span className="text-xs text-fg/55">Min. Payment</span>
          <div className="flex items-center gap-1 rounded-xl bg-card-elevated px-3 py-2">
            <span className="text-fg/60">$</span>
            <input
              id={minFieldId}
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              placeholder="0.00"
              value={minPayment}
              onChange={(e) => setMinPayment(e.target.value)}
              onBlur={commit}
              className="w-full bg-transparent text-base font-semibold text-fg outline-none placeholder:text-fg/40 tabular-nums"
            />
          </div>
        </label>
      </div>
      {account.type === "loan" && account.loanApr !== undefined && (
        <p className="mt-2 text-xs text-fg/50">
          Leave APR blank to use the loan&rsquo;s amortization rate (
          {account.loanApr.toFixed(2)}%).
        </p>
      )}
    </section>
  );
}
