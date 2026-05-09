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
};

const amountFmt = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

// Treats the input as a stream of cents — every digit shifts the
// decimal point right. Typing "3" → "0.03", "300" → "3.00",
// "30000" → "300.00". Capped at 12 digits so the cents representation
// can't overflow Number.MAX_SAFE_INTEGER.
function digitsToDisplay(digits: string): string {
  if (digits === "") return "";
  const cents = Number.parseInt(digits, 10);
  if (!Number.isFinite(cents)) return "";
  return amountFmt.format(cents / 100);
}

function digitsFromValue(value: string): string {
  return value.replace(/\D+/g, "").slice(0, 12);
}

export default function PlannerForm({
  initial,
  budgetId,
  defaultDirection,
  saveLabel,
  onSave,
  onDelete,
}: Props) {
  const initialDirection: Direction = initial
    ? initial.amount >= 0
      ? "income"
      : "expense"
    : (defaultDirection ?? "expense");

  const [direction, setDirection] = useState<Direction>(initialDirection);
  const [label, setLabel] = useState<string>(initial?.label ?? "");
  const [amountDigits, setAmountDigits] = useState<string>(
    initial ? Math.round(Math.abs(initial.amount) * 100).toString() : "",
  );
  // Empty string = "no date set". The native date input renders the
  // browser's MM/DD/YYYY placeholder when value="" so we don't need a
  // separate "set date" toggle.
  const [date, setDate] = useState<string>(initial?.date ?? "");
  const [paid, setPaid] = useState<boolean>(initial?.paid ?? false);

  const amountCents =
    amountDigits === "" ? 0 : Number.parseInt(amountDigits, 10);
  const valid = label.trim() !== "" && amountCents > 0;
  const amountDisplay = digitsToDisplay(amountDigits);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!valid) return;
    const magnitude = amountCents / 100;
    const signed = direction === "income" ? magnitude : -magnitude;
    const targetBudgetId = initial?.budgetId ?? budgetId ?? "";
    onSave({
      budgetId: targetBudgetId,
      label: label.trim(),
      amount: signed,
      date: date || undefined,
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
              type="text"
              // decimal keypad on iOS; plain text avoids the browser
              // imposing its own number formatting on top of ours.
              inputMode="decimal"
              autoComplete="off"
              placeholder="0.00"
              value={amountDisplay}
              onChange={(e) =>
                setAmountDigits(digitsFromValue(e.target.value))
              }
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
            // iOS / Android soft keyboards capitalise each word as the
            // user types, matching the expected ledger style ("Born
            // Free" rather than "born free").
            autoCapitalize="words"
          />
        </FormRow>

        <FormRow label="Date" htmlFor="planner-date">
          <TextInput
            id="planner-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            // Native date input shows MM/DD/YYYY when empty. Leaving the
            // field blank just omits the date from the saved entry.
            className="max-w-[160px]"
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
            <span className="text-fg/65">{paid ? "Cleared" : "Not yet"}</span>
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
