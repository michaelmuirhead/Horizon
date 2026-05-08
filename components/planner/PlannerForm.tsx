"use client";

import { useState, type FormEvent } from "react";
import FormGroup, { FormRow } from "@/components/forms/FormGroup";
import TextInput from "@/components/forms/TextInput";
import SegmentedField from "@/components/forms/SegmentedField";
import SaveButton from "@/components/forms/SaveButton";
import type { PlannerEntry } from "@/lib/planner";

export type PlannerFormValues = Omit<PlannerEntry, "id">;

type Direction = "expense" | "income";

type Props = {
  initial?: PlannerEntry;
  // Required: which budget the entry lands on. Edit flows pass the
  // existing entry's budgetId; new flows pass the budget the user is
  // currently inside.
  budgetId: string;
  saveLabel: string;
  onSave: (values: PlannerFormValues) => void;
  onDelete?: () => void;
  // Direction picked by the caller for new entries — Add Income vs Add
  // Expense buttons each route here with a different defaultDirection.
  defaultDirection?: Direction;
};

export default function PlannerForm({
  initial,
  budgetId,
  saveLabel,
  onSave,
  onDelete,
  defaultDirection = "expense",
}: Props) {
  const initialDirection: Direction = initial
    ? initial.amount > 0
      ? "income"
      : "expense"
    : defaultDirection;

  const [direction, setDirection] = useState<Direction>(initialDirection);
  const [label, setLabel] = useState<string>(initial?.label ?? "");
  const [amount, setAmount] = useState<string>(
    initial ? Math.abs(initial.amount).toString() : "",
  );
  const [hasDate, setHasDate] = useState<boolean>(Boolean(initial?.date));
  const [date, setDate] = useState<string>(initial?.date ?? "");
  const [paid, setPaid] = useState<boolean>(Boolean(initial?.paid));

  const valid = label.trim() !== "" && parseFloat(amount) > 0;

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!valid) return;
    const magnitude = parseFloat(amount);
    const signed = direction === "income" ? magnitude : -magnitude;
    onSave({
      budgetId,
      label: label.trim(),
      amount: signed,
      date: hasDate && date ? date : undefined,
      paid: paid || undefined,
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
          <span className="flex items-center justify-end gap-2">
            <label className="flex items-center gap-1.5 text-xs font-semibold text-fg/55">
              <input
                type="checkbox"
                checked={hasDate}
                onChange={(e) => setHasDate(e.target.checked)}
                className="accent-accent"
              />
              Set
            </label>
            {hasDate && (
              <TextInput
                id="planner-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="max-w-[160px]"
              />
            )}
          </span>
        </FormRow>

        <FormRow label="Paid" htmlFor="planner-paid">
          <span className="flex items-center justify-end">
            <input
              id="planner-paid"
              type="checkbox"
              checked={paid}
              onChange={(e) => setPaid(e.target.checked)}
              className="h-5 w-5 accent-accent"
            />
          </span>
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
