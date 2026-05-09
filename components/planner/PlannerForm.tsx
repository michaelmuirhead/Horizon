"use client";

import { useState, type FormEvent } from "react";
import FormGroup, { FormRow } from "@/components/forms/FormGroup";
import TextInput from "@/components/forms/TextInput";
import SegmentedField from "@/components/forms/SegmentedField";
import SaveButton from "@/components/forms/SaveButton";
import type { PlannerEntry } from "@/lib/planner";

// Values returned by the form. budgetId is supplied by the page that
// hosts the form (e.g. /planner/{folderId}/{budgetId}/new) so the store
// knows where to slot the entry.
export type PlannerFormValues = Omit<PlannerEntry, "id" | "order">;

type Direction = "expense" | "income";

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

type Props = {
  initial?: PlannerEntry;
  // Required for new entries — which budget to add into. When `initial`
  // is provided, the form falls back to its budgetId so a refactor that
  // forgets to thread budgetId through still works for edits.
  budgetId?: string;
  // Initial direction for new entries when no `initial` is provided.
  // Used by the income/expense quick-add buttons in the budget view.
  defaultDirection?: Direction;
  saveLabel: string;
  onSave: (values: PlannerFormValues) => void;
  onDelete?: () => void;
  // Date the form picker starts on for new entries. Defaults to today.
  defaultDate?: string;
};

export default function PlannerForm({
  initial,
  budgetId,
  defaultDirection,
  saveLabel,
  onSave,
  onDelete,
  defaultDate,
}: Props) {
  const initialDirection: Direction = initial
    ? initial.amount >= 0
      ? "income"
      : "expense"
    : (defaultDirection ?? "expense");

  const [direction, setDirection] = useState<Direction>(initialDirection);
  const [label, setLabel] = useState<string>(initial?.label ?? "");
  const [amount, setAmount] = useState<string>(
    initial ? Math.abs(initial.amount).toString() : "",
  );
  const [date, setDate] = useState<string>(
    initial?.date ?? defaultDate ?? todayIso(),
  );
  const [paid, setPaid] = useState<boolean>(initial?.paid ?? false);

  const valid = label.trim() !== "" && parseFloat(amount) > 0;

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!valid) return;
    const magnitude = parseFloat(amount);
    const signed = direction === "income" ? magnitude : -magnitude;
    const targetBudgetId = initial?.budgetId ?? budgetId ?? "";
    onSave({
      budgetId: targetBudgetId,
      label: label.trim(),
      amount: signed,
      date,
      paid,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="px-4 pt-2 pb-10 space-y-4">
      <SegmentedField<Direction>
        value={direction}
        onChange={setDirection}
        options={[
          { value: "expense", label: "Expense" },
          { value: "income", label: "Income" },
        ]}
      />

      <FormGroup>
        <FormRow label="Amount" htmlFor="planner-amount">
          <span className="flex items-center justify-end gap-1">
            <span className="text-fg/60">
              {direction === "expense" ? "−" : "+"}$
            </span>
            <TextInput
              id="planner-amount"
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

        <FormRow label="Label" htmlFor="planner-label">
          <TextInput
            id="planner-label"
            type="text"
            placeholder="What's it for?"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            required
            autoComplete="off"
          />
        </FormRow>

        <FormRow label="Date" htmlFor="planner-date">
          <TextInput
            id="planner-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
          />
        </FormRow>

        <FormRow label="Paid" htmlFor="planner-paid">
          <label className="flex items-center justify-end gap-2 text-sm">
            <input
              id="planner-paid"
              type="checkbox"
              checked={paid}
              onChange={(e) => setPaid(e.target.checked)}
              className="h-5 w-5 rounded border-fg/20 bg-card accent-accent"
            />
            <span className="text-fg/65">
              {paid ? "Cleared" : "Not yet"}
            </span>
          </label>
        </FormRow>
      </FormGroup>

      <SaveButton label={saveLabel} disabled={!valid} />

      {onDelete && (
        <button
          type="button"
          onClick={onDelete}
          className="block w-full rounded-full border border-rose-400/40 px-5 py-3.5 text-base font-bold text-rose-400"
        >
          Delete Entry
        </button>
      )}
    </form>
  );
}
