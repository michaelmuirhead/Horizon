"use client";

import { useState, type FormEvent } from "react";
import FormGroup, { FormRow } from "@/components/forms/FormGroup";
import TextInput from "@/components/forms/TextInput";
import SegmentedField from "@/components/forms/SegmentedField";
import SaveButton from "@/components/forms/SaveButton";
import type { PlannerEntry } from "@/lib/planner";

export type PlannerFormValues = Omit<PlannerEntry, "id">;

type Direction = "expense" | "income";

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

type Props = {
  initial?: PlannerEntry;
  saveLabel: string;
  onSave: (values: PlannerFormValues) => void;
  onDelete?: () => void;
  // Date the form picker starts on for new entries. Defaults to today.
  defaultDate?: string;
};

export default function PlannerForm({
  initial,
  saveLabel,
  onSave,
  onDelete,
  defaultDate,
}: Props) {
  const initialDirection: Direction =
    initial && initial.amount > 0 ? "income" : "expense";

  const [direction, setDirection] = useState<Direction>(initialDirection);
  const [label, setLabel] = useState<string>(initial?.label ?? "");
  const [amount, setAmount] = useState<string>(
    initial ? Math.abs(initial.amount).toString() : "",
  );
  const [date, setDate] = useState<string>(
    initial?.date ?? defaultDate ?? todayIso(),
  );

  const valid = label.trim() !== "" && parseFloat(amount) > 0;

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!valid) return;
    const magnitude = parseFloat(amount);
    const signed = direction === "income" ? magnitude : -magnitude;
    onSave({ label: label.trim(), amount: signed, date });
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
