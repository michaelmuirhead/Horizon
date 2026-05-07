"use client";

import { use, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import SubpageHeader from "@/components/layout/SubpageHeader";
import FormGroup, { FormRow } from "@/components/forms/FormGroup";
import TextInput from "@/components/forms/TextInput";
import SaveButton from "@/components/forms/SaveButton";
import { useHorizonStore } from "@/components/store/HorizonStore";
import { clearedAccountBalance } from "@/lib/accounts";
import { READY_TO_ASSIGN_CATEGORY } from "@/lib/budget";
import { formatCurrency } from "@/lib/format";

const RECONCILE_PAYEE = "Reconciliation Balance Adjustment";

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function ReconcilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const {
    accounts,
    transactions,
    addTransaction,
    reconcileAccount,
    recordReconciliation,
  } = useHorizonStore();
  const account = accounts.find((a) => a.id === id);
  const cleared = account ? clearedAccountBalance(account, transactions) : 0;

  const [bankBalance, setBankBalance] = useState<string>(cleared.toFixed(2));

  if (!account) {
    return (
      <>
        <SubpageHeader title="Reconcile" backHref="/accounts" />
        <div className="px-4 pt-10 text-center text-fg/70">
          <p className="text-base">Account not found.</p>
          <Link
            href="/accounts"
            className="mt-4 inline-block text-accent text-base font-bold"
          >
            Back to Accounts
          </Link>
        </div>
      </>
    );
  }

  const parsed = parseFloat(bankBalance);
  const valid = Number.isFinite(parsed);
  const diff = valid ? Math.round((parsed - cleared) * 100) / 100 : 0;
  const matches = valid && diff === 0;

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!valid || !account) return;
    const today = todayIso();
    if (diff !== 0) {
      addTransaction({
        date: today,
        payee: RECONCILE_PAYEE,
        category: READY_TO_ASSIGN_CATEGORY,
        amount: diff,
        account: account.name,
        cleared: true,
        isReadyToAssign: true,
        memo: `Reconciled to ${formatCurrency(parsed)}`,
      });
    }
    // Lock everything cleared on this account up to today as reconciled.
    reconcileAccount(account.name, today);
    recordReconciliation({
      accountId: account.id,
      date: today,
      bankBalance: parsed,
      adjustment: diff,
    });
    router.push(`/accounts/${account.id}`);
  }

  return (
    <>
      <SubpageHeader
        title="Reconcile"
        backHref={`/accounts/${account.id}`}
      />
      <form onSubmit={handleSubmit} className="px-4 pt-2 pb-10 space-y-4">
        <div className="rounded-2xl bg-card p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-fg/60">
            Cleared Balance
          </p>
          <p className="mt-1 text-3xl font-extrabold tabular-nums">
            {formatCurrency(cleared)}
          </p>
          <p className="mt-1 text-xs text-fg/55">{account.name}</p>
        </div>

        <FormGroup>
          <FormRow label="Bank Balance" htmlFor="bank-balance">
            <span className="flex items-center justify-end gap-1">
              <span className="text-fg/60">$</span>
              <TextInput
                id="bank-balance"
                type="number"
                inputMode="decimal"
                step="0.01"
                value={bankBalance}
                onChange={(e) => setBankBalance(e.target.value)}
                required
                className="max-w-[160px]"
              />
            </span>
          </FormRow>

          <FormRow label="Difference">
            <span
              className={`tabular-nums ${
                !valid
                  ? "text-fg/55"
                  : diff === 0
                    ? "text-emerald-400"
                    : diff > 0
                      ? "text-emerald-400"
                      : "text-rose-400"
              }`}
            >
              {valid ? formatCurrency(diff) : "—"}
            </span>
          </FormRow>
        </FormGroup>

        <p className="px-2 text-xs text-fg/55">
          {matches
            ? "Balances match. Tap Mark Reconciled to confirm."
            : valid
              ? `An adjustment of ${formatCurrency(diff)} will be added to Ready to Assign so the cleared balance matches the bank.`
              : "Enter the balance shown by your bank."}
        </p>

        <SaveButton
          label={matches ? "Mark Reconciled" : "Add Adjustment"}
          disabled={!valid}
        />
      </form>
    </>
  );
}
