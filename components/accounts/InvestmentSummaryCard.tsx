"use client";

import { useState, type FormEvent } from "react";
import { Trash2 } from "lucide-react";
import FormGroup, { FormRow } from "@/components/forms/FormGroup";
import TextInput from "@/components/forms/TextInput";
import { useHorizonStore } from "@/components/store/HorizonStore";
import {
  type Account,
  type InvestmentValuation,
  totalContributions,
} from "@/lib/accounts";
import { formatCurrency } from "@/lib/format";

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function InvestmentSummaryCard({
  account,
}: {
  account: Account;
}) {
  const { transactions, addInvestmentValuation, deleteInvestmentValuation } =
    useHorizonStore();
  const [date, setDate] = useState(todayIso());
  const [value, setValue] = useState("");
  const [note, setNote] = useState("");

  if (account.type !== "investment") return null;

  const valuations = (account.investmentValuations ?? [])
    .slice()
    .sort((a, b) => (a.date < b.date ? 1 : -1));
  const latest: InvestmentValuation | undefined = valuations[0];
  const contributions = totalContributions(account, transactions);
  const currentValue = latest ? latest.value : contributions;
  const gain = currentValue - contributions;
  const gainPct = contributions !== 0 ? (gain / Math.abs(contributions)) * 100 : 0;

  const valid = parseFloat(value) >= 0 && date !== "";

  function handleAdd(e: FormEvent) {
    e.preventDefault();
    if (!valid) return;
    addInvestmentValuation(account.id, {
      date,
      value: parseFloat(value),
      note: note.trim() === "" ? undefined : note.trim(),
    });
    setValue("");
    setNote("");
    setDate(todayIso());
  }

  return (
    <div className="space-y-3">
      <div className="rounded-2xl bg-card p-5">
        <p className="text-xs font-medium uppercase tracking-wide text-fg/60">
          Performance
        </p>
        <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5 text-sm">
          <dt className="text-fg/55">Current value</dt>
          <dd className="text-right font-semibold tabular-nums">
            {formatCurrency(currentValue)}
          </dd>
          <dt className="text-fg/55">Net contributions</dt>
          <dd className="text-right font-semibold tabular-nums">
            {formatCurrency(contributions)}
          </dd>
          <dt className="text-fg/55">Gain / loss</dt>
          <dd
            className={`text-right font-bold tabular-nums ${
              gain < 0 ? "text-rose-400" : "text-emerald-400"
            }`}
          >
            {gain < 0 ? "−" : "+"}
            {formatCurrency(Math.abs(gain))}
            {Number.isFinite(gainPct) && contributions !== 0 && (
              <span className="ml-1 text-xs font-semibold text-fg/55">
                ({gain < 0 ? "−" : "+"}
                {Math.abs(gainPct).toFixed(1)}%)
              </span>
            )}
          </dd>
        </dl>
        {latest && (
          <p className="mt-2 text-[11px] text-fg/45">
            Most recent valuation {latest.date}
            {latest.note ? ` — ${latest.note}` : ""}.
          </p>
        )}
      </div>

      <form onSubmit={handleAdd} className="space-y-2">
        <FormGroup>
          <FormRow label="As of" htmlFor="val-date">
            <TextInput
              id="val-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </FormRow>
          <FormRow label="Market value" htmlFor="val-value">
            <span className="flex items-center justify-end gap-1">
              <span className="text-fg/60">$</span>
              <TextInput
                id="val-value"
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                required
                className="max-w-[160px]"
              />
            </span>
          </FormRow>
          <FormRow label="Note" htmlFor="val-note">
            <TextInput
              id="val-note"
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Optional"
              autoComplete="off"
            />
          </FormRow>
        </FormGroup>
        <button
          type="submit"
          disabled={!valid}
          className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-bold text-fg disabled:opacity-40"
        >
          Record valuation
        </button>
      </form>

      {valuations.length > 0 && (
        <div className="overflow-hidden rounded-2xl bg-card">
          <p className="px-4 pt-3 text-xs font-medium uppercase tracking-wide text-fg/60">
            Valuation history
          </p>
          <ul className="mt-1 divide-y divide-fg/5">
            {valuations.map((v) => (
              <li
                key={v.id}
                className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-semibold tabular-nums">{v.date}</p>
                  {v.note && (
                    <p className="text-xs text-fg/55 truncate">{v.note}</p>
                  )}
                </div>
                <span className="font-semibold tabular-nums">
                  {formatCurrency(v.value)}
                </span>
                <button
                  type="button"
                  onClick={() => deleteInvestmentValuation(account.id, v.id)}
                  aria-label={`Delete valuation from ${v.date}`}
                  className="grid h-7 w-7 place-items-center rounded-full text-rose-400/80"
                >
                  <Trash2 size={12} strokeWidth={2.4} />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
