"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import SubpageHeader from "@/components/layout/SubpageHeader";
import FormGroup, { FormRow } from "@/components/forms/FormGroup";
import TextInput from "@/components/forms/TextInput";
import Select from "@/components/forms/Select";
import SaveButton from "@/components/forms/SaveButton";
import { useHorizonStore } from "@/components/store/HorizonStore";

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function NewTransferPage() {
  const router = useRouter();
  const { accounts: allAccounts, addTransfer } = useHorizonStore();
  const accounts = allAccounts.filter((a) => !a.closed);

  const [fromId, setFromId] = useState<string>(accounts[0]?.id ?? "");
  const [toId, setToId] = useState<string>(
    accounts.find((a) => a.id !== (accounts[0]?.id ?? ""))?.id ?? "",
  );
  const [amount, setAmount] = useState<string>("");
  const [date, setDate] = useState<string>(todayIso());
  const [memo, setMemo] = useState<string>("");
  const [cleared, setCleared] = useState<boolean>(true);

  const parsed = parseFloat(amount);
  const valid =
    accounts.length >= 2 &&
    fromId !== "" &&
    toId !== "" &&
    fromId !== toId &&
    parsed > 0;

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!valid) return;
    const fromAccount = accounts.find((a) => a.id === fromId);
    const toAccount = accounts.find((a) => a.id === toId);
    if (!fromAccount || !toAccount) return;
    addTransfer({
      date,
      fromAccount: fromAccount.name,
      toAccount: toAccount.name,
      amount: parsed,
      cleared,
      memo: memo.trim() || undefined,
    });
    router.push("/spending");
  }

  if (accounts.length < 2) {
    return (
      <>
        <SubpageHeader title="New Transfer" backHref="/spending" />
        <div className="px-4 pt-10 text-center text-fg/70">
          <p className="text-base">
            Transfers need at least two accounts. Add another account first.
          </p>
        </div>
      </>
    );
  }

  return (
    <>
      <SubpageHeader title="New Transfer" backHref="/spending" />
      <form onSubmit={handleSubmit} className="px-4 pt-2 pb-10 space-y-4">
        <FormGroup>
          <FormRow label="From" htmlFor="transfer-from">
            <Select
              id="transfer-from"
              value={fromId}
              onChange={(e) => setFromId(e.target.value)}
            >
              {accounts.map((a) => (
                <option key={a.id} value={a.id} className="bg-card">
                  {a.name}
                </option>
              ))}
            </Select>
          </FormRow>

          <FormRow label="To" htmlFor="transfer-to">
            <Select
              id="transfer-to"
              value={toId}
              onChange={(e) => setToId(e.target.value)}
            >
              {accounts
                .filter((a) => a.id !== fromId)
                .map((a) => (
                  <option key={a.id} value={a.id} className="bg-card">
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

        <SaveButton label="Save Transfer" disabled={!valid} />
      </form>
    </>
  );
}
