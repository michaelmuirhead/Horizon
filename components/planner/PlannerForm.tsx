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

const amountFmt = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

// Treats the input as a stream of cents — every digit shifts the
// decimal point right. Typing "3" → "0.03", "300" → "3.00",
// "30000" → "300.00". Limits to 12 digits so we don't overflow the
// formatter on accidental long pastes.
function digitsToDisplay(digits: string): string {
  if (digits === "") return "";
  const cents = Number.parseInt(digits, 10);
  if (!Number.isFinite(cents)) return "";
  return amountFmt.format(cents / 100);
}

function digitsFromValue(value: string): string {
  // Drop everything that isn't a digit and clamp length so the cents
  // representation can't overflow Number.MAX_SAFE_INTEGER.
  return value.replace(/\D+/g, "").slice(0, 12);
}

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
  const [amountDigits, setAmountDigits] = useState<string>(
    initial
      ? Math.round(Math.abs(initial.amount) * 100).toString()
      : "",
  );
  const [date, setDate] = useState<string>(initial?.date ?? "");
  const [paid, setPaid] = useState<boolean>(Boolean(initial?.paid));

  const amountCents = amountDigits === "" ? 0 : Number.parseInt(amountDigits, 10);
  const valid = label.trim() !== "" && amountCents > 0;
  const amountDisplay = digitsToDisplay(amountDigits);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!valid) return;
    const magnitude = amountCents / 100;
    const signed = direction === "income" ? magnitude : -magnitude;
    onSave({
      budgetId,
      label: label.trim(),
      amount: signed,
      date: date || undefined,
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
              type="text"
              // decimal keyboard on iOS; plain text avoids the browser
              // imposing its own formatting on top of ours.
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
            // Native date input shows an MM/DD/YYYY placeholder when
            // empty; leaving the field blank simply omits the date
            // from the saved entry.
            className="max-w-[160px]"
          />
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
