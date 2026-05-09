"use client";

import { useState, type FormEvent } from "react";
import FormGroup, { FormRow } from "@/components/forms/FormGroup";
import TextInput from "@/components/forms/TextInput";
import Select from "@/components/forms/Select";
import SegmentedField from "@/components/forms/SegmentedField";
import SaveButton from "@/components/forms/SaveButton";
import { useHorizonStore } from "@/components/store/HorizonStore";
import { allCategoryNames, READY_TO_ASSIGN_CATEGORY } from "@/lib/budget";
import {
  cadenceLabels,
  todayIso,
  type ScheduledCadence,
  type ScheduledTransaction,
} from "@/lib/scheduled";

// Distributive Omit so the union arms keep their own required fields after
// stripping `id`. `Omit<A | B, "id">` would smush them into one shape.
type DistOmit<T, K extends keyof any> = T extends unknown ? Omit<T, K> : never;
export type ScheduledFormValues = DistOmit<ScheduledTransaction, "id">;

type Direction = "outflow" | "inflow";
type Kind = "transaction" | "transfer";

function detectDirection(
  amount: number,
  isReadyToAssign: boolean | undefined,
): Direction {
  if (isReadyToAssign) return "inflow";
  return amount > 0 ? "inflow" : "outflow";
}

type Props = {
  initial?: ScheduledTransaction;
  saveLabel: string;
  onSave: (values: ScheduledFormValues) => void;
  onDelete?: () => void;
};

export default function ScheduledForm({
  initial,
  saveLabel,
  onSave,
  onDelete,
}: Props) {
  const { accounts: allAccounts } = useHorizonStore();
  const initialAccountName =
    initial && initial.kind !== "transfer" ? initial.account : undefined;
  const accounts = allAccounts.filter(
    (a) => !a.closed || a.name === initialAccountName,
  );
  const categoryNames = allCategoryNames();

  const initialKind: Kind =
    initial && initial.kind === "transfer" ? "transfer" : "transaction";
  const [kind, setKind] = useState<Kind>(initialKind);

  // Transaction-only fields
  const initialDirection: Direction =
    initial && initial.kind !== "transfer"
      ? detectDirection(initial.amount, initial.isReadyToAssign)
      : "outflow";
  const initialAccountId =
    initial && initial.kind !== "transfer"
      ? (accounts.find((a) => a.name === initial.account)?.id ??
        accounts[0]?.id ??
        "")
      : (accounts[0]?.id ?? "");

  const [direction, setDirection] = useState<Direction>(initialDirection);
  const [accountId, setAccountId] = useState<string>(initialAccountId);
  const [payee, setPayee] = useState<string>(
    initial && initial.kind !== "transfer" ? initial.payee : "",
  );
  const [category, setCategory] = useState<string>(
    initial && initial.kind !== "transfer" && !initial.isReadyToAssign
      ? initial.category
      : (categoryNames[0] ?? ""),
  );

  // Transfer-only fields
  const [fromAccountId, setFromAccountId] = useState<string>(
    initial && initial.kind === "transfer"
      ? (accounts.find((a) => a.name === initial.fromAccount)?.id ??
        accounts[0]?.id ??
        "")
      : (accounts[0]?.id ?? ""),
  );
  const [toAccountId, setToAccountId] = useState<string>(
    initial && initial.kind === "transfer"
      ? (accounts.find((a) => a.name === initial.toAccount)?.id ??
        accounts.find((a) => a.id !== (accounts[0]?.id ?? ""))?.id ??
        "")
      : (accounts.find((a) => a.id !== (accounts[0]?.id ?? ""))?.id ?? ""),
  );

  // Common fields
  const [cadence, setCadence] = useState<ScheduledCadence>(
    initial?.cadence ?? "monthly",
  );
  const [nextDate, setNextDate] = useState<string>(
    initial?.nextDate ?? todayIso(),
  );
  const [amount, setAmount] = useState<string>(
    initial ? Math.abs(initial.amount).toString() : "",
  );
  const [memo, setMemo] = useState<string>(initial?.memo ?? "");

  const parsedAmount = parseFloat(amount);
  const valid =
    parsedAmount > 0 &&
    (kind === "transfer"
      ? fromAccountId !== "" &&
        toAccountId !== "" &&
        fromAccountId !== toAccountId
      : accountId !== "" && payee.trim() !== "");

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!valid) return;

    if (kind === "transfer") {
      const from = accounts.find((a) => a.id === fromAccountId);
      const to = accounts.find((a) => a.id === toAccountId);
      if (!from || !to) return;
      onSave({
        kind: "transfer",
        cadence,
        nextDate,
        fromAccount: from.name,
        toAccount: to.name,
        amount: parsedAmount,
        memo: memo.trim() || undefined,
      });
      return;
    }

    const account = accounts.find((a) => a.id === accountId);
    if (!account) return;
    const signed = direction === "inflow" ? parsedAmount : -parsedAmount;
    const isReadyToAssign = direction === "inflow";
    onSave({
      cadence,
      nextDate,
      payee: payee.trim(),
      category: isReadyToAssign ? READY_TO_ASSIGN_CATEGORY : category,
      amount: signed,
      account: account.name,
      memo: memo.trim() || undefined,
      isReadyToAssign,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="px-4 pt-2 pb-10 space-y-4">
      <SegmentedField<Kind>
        value={kind}
        onChange={setKind}
        options={[
          { value: "transaction", label: "Transaction" },
          { value: "transfer", label: "Transfer" },
        ]}
      />

      {kind === "transaction" && (
        <SegmentedField<Direction>
          value={direction}
          onChange={setDirection}
          options={[
            { value: "outflow", label: "Outflow" },
            { value: "inflow", label: "Inflow" },
          ]}
        />
      )}

      <FormGroup>
        <FormRow label="Amount" htmlFor="sched-amount">
          <span className="flex items-center justify-end gap-1">
            <span className="text-fg/60">
              {kind === "transfer"
                ? "$"
                : direction === "outflow"
                  ? "−$"
                  : "+$"}
            </span>
            <TextInput
              id="sched-amount"
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

        <FormRow label="Repeats" htmlFor="sched-cadence">
          <Select
            id="sched-cadence"
            value={cadence}
            onChange={(e) => setCadence(e.target.value as ScheduledCadence)}
          >
            {(Object.keys(cadenceLabels) as ScheduledCadence[]).map((c) => (
              <option key={c} value={c} className="bg-card">
                {cadenceLabels[c]}
              </option>
            ))}
          </Select>
        </FormRow>

        <FormRow label="Next Date" htmlFor="sched-next">
          <TextInput
            id="sched-next"
            type="date"
            value={nextDate}
            onChange={(e) => setNextDate(e.target.value)}
            required
          />
        </FormRow>

        {kind === "transfer" ? (
          <>
            <FormRow label="From" htmlFor="sched-from">
              <Select
                id="sched-from"
                value={fromAccountId}
                onChange={(e) => setFromAccountId(e.target.value)}
              >
                {accounts.map((a) => (
                  <option key={a.id} value={a.id} className="bg-card">
                    {a.name}
                  </option>
                ))}
              </Select>
            </FormRow>
            <FormRow label="To" htmlFor="sched-to">
              <Select
                id="sched-to"
                value={toAccountId}
                onChange={(e) => setToAccountId(e.target.value)}
              >
                {accounts
                  .filter((a) => a.id !== fromAccountId)
                  .map((a) => (
                    <option key={a.id} value={a.id} className="bg-card">
                      {a.name}
                    </option>
                  ))}
              </Select>
            </FormRow>
          </>
        ) : (
          <>
            <FormRow label="Account" htmlFor="sched-account">
              {accounts.length === 0 ? (
                <span className="text-fg/55">No accounts yet</span>
              ) : (
                <Select
                  id="sched-account"
                  value={accountId}
                  onChange={(e) => setAccountId(e.target.value)}
                >
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id} className="bg-card">
                      {a.name}
                    </option>
                  ))}
                </Select>
              )}
            </FormRow>

            <FormRow label="Payee" htmlFor="sched-payee">
              <TextInput
                id="sched-payee"
                type="text"
                placeholder="Required"
                value={payee}
                onChange={(e) => setPayee(e.target.value)}
                required
                autoComplete="off"
              />
            </FormRow>

            {direction === "outflow" && (
              <FormRow label="Category" htmlFor="sched-category">
                <Select
                  id="sched-category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                >
                  {categoryNames.map((name) => (
                    <option key={name} value={name} className="bg-card">
                      {name}
                    </option>
                  ))}
                </Select>
              </FormRow>
            )}
          </>
        )}

        <FormRow label="Memo" htmlFor="sched-memo">
          <TextInput
            id="sched-memo"
            type="text"
            placeholder="Optional"
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            autoComplete="off"
          />
        </FormRow>
      </FormGroup>

      <SaveButton label={saveLabel} disabled={!valid} />

      {onDelete && (
        <button
          type="button"
          onClick={onDelete}
          className="block w-full rounded-full border border-rose-400/40 px-5 py-3.5 text-base font-bold text-rose-400"
        >
          Delete Scheduled
        </button>
      )}
    </form>
  );
}
