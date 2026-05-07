"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { ArrowLeftRight } from "lucide-react";
import TransactionForm from "@/components/spending/TransactionForm";
import FormGroup, { FormRow } from "@/components/forms/FormGroup";
import TextInput from "@/components/forms/TextInput";
import Select from "@/components/forms/Select";
import SaveButton from "@/components/forms/SaveButton";
import { useHorizonStore } from "@/components/store/HorizonStore";
import type { Transaction } from "@/lib/transactions";
import type { Account } from "@/lib/accounts";

type Props = {
  transactionId: string;
  // Fired after a successful save or delete. The parent decides whether to
  // navigate away (standalone /spending/[id]) or just clear the selection
  // (two-pane Spending).
  onAfterCommit: () => void;
};

export default function TransactionDetailPanel({
  transactionId,
  onAfterCommit,
}: Props) {
  const {
    transactions,
    accounts,
    updateTransaction,
    deleteTransaction,
    updateTransfer,
    deleteTransfer,
    addTransfer,
    markUndoable,
  } = useHorizonStore();
  const tx = transactions.find((t) => t.id === transactionId);

  if (!tx) {
    return (
      <div className="px-4 pt-10 text-center text-fg/70">
        <p className="text-base">Transaction not found.</p>
        <Link
          href="/spending"
          className="mt-4 inline-block text-accent text-base font-bold"
        >
          Back to Spending
        </Link>
      </div>
    );
  }

  if (tx.transferId) {
    const sibling = transactions.find(
      (t) => t.transferId === tx.transferId && t.id !== tx.id,
    );
    const fromTx = tx.amount < 0 ? tx : sibling;
    const toTx = tx.amount > 0 ? tx : sibling;

    return (
      <TransferEditView
        tx={tx}
        accounts={accounts}
        fromAccountName={fromTx?.account ?? ""}
        toAccountName={toTx?.account ?? ""}
        onSave={(values) => {
          if (!tx.transferId) return;
          const amountChanged =
            Math.abs(Math.abs(tx.amount) - values.amount) > 0.001;
          const accountsChanged =
            values.fromAccount !== (fromTx?.account ?? "") ||
            values.toAccount !== (toTx?.account ?? "");
          if (amountChanged || accountsChanged) {
            deleteTransfer(tx.transferId);
            addTransfer({
              date: values.date,
              fromAccount: values.fromAccount,
              toAccount: values.toAccount,
              amount: values.amount,
              cleared: values.cleared,
              memo: values.memo,
            });
          } else {
            updateTransfer({
              transferId: tx.transferId,
              date: values.date,
              memo: values.memo,
              cleared: values.cleared,
            });
          }
          onAfterCommit();
        }}
        onDelete={() => {
          if (
            window.confirm(
              "Delete this transfer? Both the outflow and the inflow will be removed.",
            )
          ) {
            markUndoable("Transfer deleted");
            if (tx.transferId) deleteTransfer(tx.transferId);
            onAfterCommit();
          }
        }}
      />
    );
  }

  return (
    <TransactionForm
      initial={tx}
      saveLabel="Save Changes"
      onSave={(values) => {
        updateTransaction({ id: tx.id, ...values });
        onAfterCommit();
      }}
      onDelete={() => {
        if (window.confirm(`Delete this transaction with ${tx.payee}?`)) {
          markUndoable(`Transaction "${tx.payee}" deleted`);
          deleteTransaction(tx.id);
          onAfterCommit();
        }
      }}
    />
  );
}

function TransferEditView({
  tx,
  accounts,
  fromAccountName,
  toAccountName,
  onSave,
  onDelete,
}: {
  tx: Transaction;
  accounts: Account[];
  fromAccountName: string;
  toAccountName: string;
  onSave: (values: {
    date: string;
    memo: string | undefined;
    cleared: boolean;
    amount: number;
    fromAccount: string;
    toAccount: string;
  }) => void;
  onDelete: () => void;
}) {
  // Closed accounts disappear from the picker, but stay available if the
  // transfer being edited still references one.
  const visibleAccounts = accounts.filter(
    (a) =>
      !a.closed || a.name === fromAccountName || a.name === toAccountName,
  );

  const [date, setDate] = useState<string>(tx.date);
  const [memo, setMemo] = useState<string>(tx.memo ?? "");
  const [cleared, setCleared] = useState<boolean>(tx.cleared);
  const [fromAccount, setFromAccount] = useState<string>(fromAccountName);
  const [toAccount, setToAccount] = useState<string>(toAccountName);
  const [amount, setAmount] = useState<string>(Math.abs(tx.amount).toFixed(2));

  const parsed = parseFloat(amount);
  const valid =
    fromAccount !== "" &&
    toAccount !== "" &&
    fromAccount !== toAccount &&
    Number.isFinite(parsed) &&
    parsed > 0;

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!valid) return;
    onSave({
      date,
      memo: memo.trim() === "" ? undefined : memo.trim(),
      cleared,
      amount: parsed,
      fromAccount,
      toAccount,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="px-4 pt-2 pb-10 space-y-4">
      <div className="rounded-2xl bg-card p-5">
        <div className="flex items-center gap-2 text-sky-300">
          <ArrowLeftRight size={18} strokeWidth={2.4} />
          <span className="text-sm font-bold uppercase tracking-wide">
            Transfer
          </span>
        </div>
      </div>

      <FormGroup>
        <FormRow label="From" htmlFor="transfer-from">
          <Select
            id="transfer-from"
            value={fromAccount}
            onChange={(e) => setFromAccount(e.target.value)}
          >
            {visibleAccounts.map((a) => (
              <option key={a.id} value={a.name} className="bg-card">
                {a.name}
              </option>
            ))}
          </Select>
        </FormRow>

        <FormRow label="To" htmlFor="transfer-to">
          <Select
            id="transfer-to"
            value={toAccount}
            onChange={(e) => setToAccount(e.target.value)}
          >
            {visibleAccounts
              .filter((a) => a.name !== fromAccount)
              .map((a) => (
                <option key={a.id} value={a.name} className="bg-card">
                  {a.name}
                </option>
              ))}
          </Select>
        </FormRow>

        <FormRow label="Amount" htmlFor="transfer-amount">
          <span className="flex items-center justify-end gap-1">
            <span className="text-fg/60">$</span>
            <TextInput
              id="transfer-amount"
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
              className="max-w-[160px]"
            />
          </span>
        </FormRow>

        <FormRow label="Date" htmlFor="transfer-date">
          <TextInput
            id="transfer-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
          />
        </FormRow>

        <FormRow label="Memo" htmlFor="transfer-memo">
          <TextInput
            id="transfer-memo"
            type="text"
            placeholder="Optional"
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            autoComplete="off"
          />
        </FormRow>

        <FormRow label="Cleared">
          <button
            type="button"
            role="switch"
            aria-checked={cleared}
            onClick={() => setCleared((v) => !v)}
            className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${
              cleared ? "bg-emerald-500" : "bg-white/20"
            }`}
          >
            <span
              className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${
                cleared ? "translate-x-5" : "translate-x-0.5"
              }`}
            />
          </button>
        </FormRow>
      </FormGroup>

      <p className="px-2 text-xs text-fg/55">
        Changing the amount or accounts replaces the transfer pair, so the
        underlying transaction ids change.
      </p>

      <SaveButton label="Save Changes" disabled={!valid} />

      <button
        type="button"
        onClick={onDelete}
        className="block w-full rounded-full border border-rose-400/40 px-5 py-3.5 text-base font-bold text-rose-400"
      >
        Delete Transfer
      </button>
    </form>
  );
}
