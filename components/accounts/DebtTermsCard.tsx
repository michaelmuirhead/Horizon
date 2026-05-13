"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CalendarClock } from "lucide-react";
import type { Account } from "@/lib/accounts";
import { useHorizonStore } from "@/components/store/HorizonStore";
import { nextDueDate, ordinalDay } from "@/lib/debtDueDate";

function toInputValue(n: number | undefined): string {
  return typeof n === "number" ? String(n) : "";
}

function parseOptionalNumber(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  const parsed = parseFloat(trimmed);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

// Clamps the day to 1..31; anything else (including blanks) is "unset".
function parseDueDay(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  const parsed = parseInt(trimmed, 10);
  if (!Number.isFinite(parsed) || parsed < 1 || parsed > 31) return null;
  return parsed;
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
  const [dueDay, setDueDay] = useState(
    toInputValue(account.paymentDueDayOfMonth),
  );
  const [savedHint, setSavedHint] = useState(false);

  // If the account changes (e.g. switching detail pages), refresh inputs.
  useEffect(() => {
    setApr(initialApr);
    setMinPayment(toInputValue(account.minimumPayment));
    setDueDay(toInputValue(account.paymentDueDayOfMonth));
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
      paymentDueDayOfMonth: parseDueDay(dueDay),
    });
    setSavedHint(true);
  }

  const aprFieldId = `debt-apr-${account.id}`;
  const minFieldId = `debt-min-${account.id}`;
  const dueFieldId = `debt-due-${account.id}`;

  // Build a one-tap "Schedule monthly payment" link that prefills the
  // new-scheduled-transaction form. We only render it when both a min
  // payment and a due day are set, otherwise there's nothing useful to
  // prefill. The user picks the funding account + category on that page.
  const dueDayNum = parseDueDay(dueDay);
  const minNum = parseOptionalNumber(minPayment);
  const nextDue = dueDayNum !== null ? nextDueDate(dueDayNum) : null;
  const scheduleHref =
    dueDayNum !== null && minNum !== null && minNum > 0 && nextDue
      ? `/spending/scheduled/new?` +
        new URLSearchParams({
          label: `${account.name} payment`,
          amount: String(-Math.abs(minNum)),
          date: nextDue,
          cadence: "monthly",
        }).toString()
      : null;

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
        <label htmlFor={dueFieldId} className="col-span-2 flex flex-col gap-1">
          <span className="text-xs text-fg/55">Due Day (1&ndash;31)</span>
          <input
            id={dueFieldId}
            type="number"
            inputMode="numeric"
            step="1"
            min="1"
            max="31"
            placeholder="e.g. 15"
            value={dueDay}
            onChange={(e) => setDueDay(e.target.value)}
            onBlur={commit}
            className="rounded-xl bg-card-elevated px-3 py-2 text-base font-semibold text-fg outline-none placeholder:text-fg/40 tabular-nums"
          />
          {dueDayNum !== null && (
            <span className="mt-0.5 text-[11px] text-fg/55">
              Recurring on the {ordinalDay(dueDayNum)} of each month.
            </span>
          )}
        </label>
      </div>
      {account.type === "loan" && account.loanApr !== undefined && (
        <p className="mt-2 text-xs text-fg/50">
          Leave APR blank to use the loan&rsquo;s amortization rate (
          {account.loanApr.toFixed(2)}%).
        </p>
      )}
      {scheduleHref && (
        <Link
          href={scheduleHref}
          className="mt-3 flex items-center justify-center gap-2 rounded-full border border-accent/40 px-4 py-2.5 text-sm font-bold text-accent"
        >
          <CalendarClock size={16} strokeWidth={2.4} />
          Schedule monthly payment
        </Link>
      )}
    </section>
  );
}
