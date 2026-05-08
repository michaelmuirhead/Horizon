"use client";

import { useState, type FormEvent } from "react";
import { Plus, Minus } from "lucide-react";
import { useHorizonStore } from "@/components/store/HorizonStore";

type Direction = "expense" | "income";

type Props = {
  // Date assigned to entries added from this bar. Callers pass the most
  // sensible "today within the viewed month" — current page chooses today
  // when looking at this month, otherwise the 1st of the picked month.
  date: string;
};

// Fudget's signature single-line entry: tap +/-, type a label, tap an amount,
// hit return. We mirror that ergonomic by keeping inputs flat in a row and
// returning focus to the label after a successful add so the user can keep
// burning through entries without lifting their hands.
export default function QuickAddBar({ date }: Props) {
  const { addPlannerEntry } = useHorizonStore();
  const [direction, setDirection] = useState<Direction>("expense");
  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState("");

  const magnitude = parseFloat(amount);
  const valid = label.trim() !== "" && magnitude > 0;

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!valid) return;
    const signed = direction === "income" ? magnitude : -magnitude;
    addPlannerEntry({ label: label.trim(), amount: signed, date });
    setLabel("");
    setAmount("");
  }

  function toggleDirection() {
    setDirection((d) => (d === "expense" ? "income" : "expense"));
  }

  const isIncome = direction === "income";

  return (
    <form
      onSubmit={handleSubmit}
      className="flex items-center gap-2 rounded-2xl bg-card px-2 py-2"
      aria-label="Quick add planner entry"
    >
      <button
        type="button"
        onClick={toggleDirection}
        aria-label={
          isIncome ? "Switch to expense" : "Switch to income"
        }
        aria-pressed={isIncome}
        className={`grid h-10 w-10 shrink-0 place-items-center rounded-full font-bold transition-colors ${
          isIncome
            ? "bg-emerald-500/15 text-emerald-400"
            : "bg-rose-500/15 text-rose-400"
        }`}
      >
        {isIncome ? (
          <Plus size={18} strokeWidth={3} />
        ) : (
          <Minus size={18} strokeWidth={3} />
        )}
      </button>

      <input
        type="text"
        placeholder="Label"
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        autoComplete="off"
        className="min-w-0 flex-1 bg-transparent text-base font-semibold text-fg placeholder:text-fg/40 outline-none"
        aria-label="Entry label"
      />

      <input
        type="number"
        inputMode="decimal"
        step="0.01"
        min="0"
        placeholder="0.00"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        className="w-24 bg-transparent text-right text-base font-semibold tabular-nums text-fg placeholder:text-fg/40 outline-none"
        aria-label="Entry amount"
      />

      <button
        type="submit"
        disabled={!valid}
        aria-label="Add entry"
        className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-accent text-page disabled:opacity-40"
      >
        <Plus size={18} strokeWidth={3} />
      </button>
    </form>
  );
}
