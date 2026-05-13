"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarClock, CheckCircle2, X } from "lucide-react";
import type { Account } from "@/lib/accounts";
import { ASSET_ACCOUNT_TYPES } from "@/lib/accounts";
import { useHorizonStore } from "@/components/store/HorizonStore";
import { nextDueDate, ordinalDay } from "@/lib/debtDueDate";
import { isTransferSchedule } from "@/lib/scheduled";

function toInputValue(n: number | undefined): string {
  return typeof n === "number" ? String(n) : "";
}

function parseOptionalNumber(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  const parsed = parseFloat(trimmed);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function parseDueDay(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  const parsed = parseInt(trimmed, 10);
  if (!Number.isFinite(parsed) || parsed < 1 || parsed > 31) return null;
  return parsed;
}

// Type-preference for the auto-picked funding account when the user
// hasn't chosen one. Checking is far and away the most common funding
// source for debt payments, then savings, then cash, then anything else
// asset-shaped — investments fall to the end since automating a draw
// from a brokerage is a foot-gun.
const FUNDING_TYPE_PREFERENCE = ["checking", "savings", "cash", "investment"];

function pickDefaultFundingAccount(
  accounts: Account[],
  savedId: string | undefined,
): Account | null {
  const assetAccounts = accounts.filter(
    (a) => ASSET_ACCOUNT_TYPES.has(a.type) && !a.closed,
  );
  if (savedId) {
    const saved = assetAccounts.find((a) => a.id === savedId);
    if (saved) return saved;
  }
  for (const type of FUNDING_TYPE_PREFERENCE) {
    const match = assetAccounts.find((a) => a.type === type);
    if (match) return match;
  }
  return assetAccounts[0] ?? null;
}

function shortDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, (m ?? 1) - 1, d ?? 1);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(date);
}

export default function DebtTermsCard({ account }: { account: Account }) {
  const {
    accounts,
    scheduledTransactions,
    setAccountDebtTerms,
    addScheduled,
    deleteScheduled,
  } = useHorizonStore();

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
  const fundingDefault = useMemo(
    () => pickDefaultFundingAccount(accounts, account.defaultFundingAccountId),
    [accounts, account.defaultFundingAccountId],
  );
  const [fundingId, setFundingId] = useState<string>(fundingDefault?.id ?? "");
  const [savedHint, setSavedHint] = useState(false);
  const [scheduledHint, setScheduledHint] = useState(false);

  // If the account changes (e.g. switching detail pages), refresh inputs.
  useEffect(() => {
    setApr(initialApr);
    setMinPayment(toInputValue(account.minimumPayment));
    setDueDay(toInputValue(account.paymentDueDayOfMonth));
    setFundingId(fundingDefault?.id ?? "");
    // initialApr / fundingDefault are derived from the account + accounts
    // list above and don't need to be deps themselves.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account.id]);

  useEffect(() => {
    if (!savedHint && !scheduledHint) return;
    const t = setTimeout(() => {
      setSavedHint(false);
      setScheduledHint(false);
    }, 1500);
    return () => clearTimeout(t);
  }, [savedHint, scheduledHint]);

  function commit() {
    setAccountDebtTerms(account.id, {
      apr: parseOptionalNumber(apr),
      minimumPayment: parseOptionalNumber(minPayment),
      paymentDueDayOfMonth: parseDueDay(dueDay),
      defaultFundingAccountId: fundingId === "" ? null : fundingId,
    });
    setSavedHint(true);
  }

  const aprFieldId = `debt-apr-${account.id}`;
  const minFieldId = `debt-min-${account.id}`;
  const dueFieldId = `debt-due-${account.id}`;
  const fundFieldId = `debt-fund-${account.id}`;

  const dueDayNum = parseDueDay(dueDay);
  const minNum = parseOptionalNumber(minPayment);
  const nextDueIso = dueDayNum !== null ? nextDueDate(dueDayNum) : null;
  const fundingAccount = accounts.find((a) => a.id === fundingId);

  // Heuristic match for an already-scheduled monthly transfer into
  // this debt: by toAccount name + cadence. If the debt account is
  // renamed after scheduling, the link breaks and the card will offer
  // to re-schedule (duplicate). We accept that — renaming is rare and
  // recoverable.
  const existingSchedule = useMemo(() => {
    return scheduledTransactions.find(
      (s) =>
        isTransferSchedule(s) &&
        s.cadence === "monthly" &&
        s.toAccount === account.name,
    );
  }, [scheduledTransactions, account.name]);

  const scheduleReady =
    dueDayNum !== null &&
    minNum !== null &&
    minNum > 0 &&
    nextDueIso !== null &&
    fundingAccount !== undefined;

  function handleSchedule() {
    if (!scheduleReady || !nextDueIso || !fundingAccount || minNum === null) {
      return;
    }
    // Persist the funding-account choice on the debt so the next
    // schedule (or schedule-after-delete) reuses it without prompting.
    setAccountDebtTerms(account.id, {
      apr: parseOptionalNumber(apr),
      minimumPayment: minNum,
      paymentDueDayOfMonth: dueDayNum,
      defaultFundingAccountId: fundingAccount.id,
    });
    addScheduled({
      kind: "transfer",
      cadence: "monthly",
      nextDate: nextDueIso,
      fromAccount: fundingAccount.name,
      toAccount: account.name,
      amount: Math.abs(minNum),
      memo: `${account.name} minimum payment`,
    });
    setScheduledHint(true);
  }

  function handleUnschedule() {
    if (!existingSchedule) return;
    deleteScheduled(existingSchedule.id);
  }

  return (
    <section className="rounded-2xl bg-card p-5">
      <div className="flex items-baseline justify-between">
        <p className="text-xs font-medium uppercase tracking-wide text-fg/60">
          Debt Terms
        </p>
        {(savedHint || scheduledHint) && (
          <span className="text-xs font-semibold text-emerald-400">
            {scheduledHint ? "Scheduled" : "Saved"}
          </span>
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
        <label htmlFor={fundFieldId} className="col-span-2 flex flex-col gap-1">
          <span className="text-xs text-fg/55">Pay from</span>
          <select
            id={fundFieldId}
            value={fundingId}
            onChange={(e) => setFundingId(e.target.value)}
            onBlur={commit}
            className="rounded-xl bg-card-elevated px-3 py-2 text-base font-semibold text-fg outline-none"
          >
            <option value="">Select an account…</option>
            {accounts
              .filter((a) => ASSET_ACCOUNT_TYPES.has(a.type) && !a.closed)
              .map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
          </select>
        </label>
      </div>
      {account.type === "loan" && account.loanApr !== undefined && (
        <p className="mt-2 text-xs text-fg/50">
          Leave APR blank to use the loan&rsquo;s amortization rate (
          {account.loanApr.toFixed(2)}%).
        </p>
      )}

      {existingSchedule ? (
        <div className="mt-3 flex items-center justify-between gap-3 rounded-2xl bg-emerald-500/10 px-4 py-2.5 text-sm">
          <div className="flex items-center gap-2 text-emerald-300">
            <CheckCircle2 size={16} strokeWidth={2.4} />
            <span className="font-bold">
              Scheduled monthly · next {shortDate(existingSchedule.nextDate)}
            </span>
          </div>
          <button
            type="button"
            onClick={handleUnschedule}
            aria-label="Remove scheduled payment"
            className="grid h-7 w-7 place-items-center rounded-full text-emerald-300/80 hover:bg-emerald-500/15"
          >
            <X size={14} strokeWidth={2.4} />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={handleSchedule}
          disabled={!scheduleReady}
          className={`mt-3 flex w-full items-center justify-center gap-2 rounded-full border px-4 py-2.5 text-sm font-bold transition-colors ${
            scheduleReady
              ? "border-accent/40 text-accent"
              : "border-fg/15 text-fg/40 cursor-not-allowed"
          }`}
        >
          <CalendarClock size={16} strokeWidth={2.4} />
          Schedule monthly payment
        </button>
      )}
      {!scheduleReady && !existingSchedule && (
        <p className="mt-2 text-[11px] text-fg/45">
          Set a minimum payment, due day, and pay-from account to enable
          scheduling.
        </p>
      )}
    </section>
  );
}
