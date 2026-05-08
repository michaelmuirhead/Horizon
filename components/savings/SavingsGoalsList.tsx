"use client";

import Link from "next/link";
import { PlusCircle } from "lucide-react";
import { useHorizonStore } from "@/components/store/HorizonStore";
import { sortGoalsByProgress, summarizeGoals } from "@/lib/savingsGoals";
import { formatCurrency } from "@/lib/format";
import SavingsGoalRow from "./SavingsGoalRow";

export default function SavingsGoalsList() {
  const { savingsGoals } = useHorizonStore();
  const sorted = sortGoalsByProgress(savingsGoals);
  const summary = summarizeGoals(savingsGoals);
  const overallPct =
    summary.totalTarget > 0
      ? Math.min(100, Math.round((summary.totalSaved / summary.totalTarget) * 100))
      : 0;

  if (savingsGoals.length === 0) {
    return (
      <div className="space-y-4">
        <div className="rounded-2xl bg-card p-6 text-center text-fg/65">
          <p className="text-base font-semibold text-fg/85">
            No savings goals yet
          </p>
          <p className="mt-1 text-sm">
            Set up a goal — like a vacation fund or emergency cushion — and
            track deposits and withdrawals against it.
          </p>
        </div>
        <Link
          href="/savings/new"
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-card-elevated px-5 py-4 text-base font-bold text-accent"
        >
          <PlusCircle size={20} strokeWidth={2.4} />
          Add a savings goal
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <section className="rounded-2xl bg-card p-5">
        <p className="text-xs font-medium uppercase tracking-wide text-fg/60">
          Total Saved
        </p>
        <p className="mt-1 text-3xl font-extrabold tabular-nums text-emerald-400">
          {formatCurrency(summary.totalSaved)}
        </p>
        <p className="mt-1 text-xs text-fg/55 tabular-nums">
          of {formatCurrency(summary.totalTarget)} across {summary.count}{" "}
          {summary.count === 1 ? "goal" : "goals"}
          {summary.reachedCount > 0 && (
            <> · {summary.reachedCount} reached</>
          )}
        </p>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-card-elevated">
          <div
            className="h-full bg-emerald-400"
            style={{ width: `${overallPct}%` }}
          />
        </div>
      </section>

      <ul className="flex flex-col gap-2">
        {sorted.map((goal) => (
          <li key={goal.id}>
            <SavingsGoalRow goal={goal} />
          </li>
        ))}
      </ul>

      <Link
        href="/savings/new"
        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-card-elevated px-5 py-4 text-base font-bold text-accent"
      >
        <PlusCircle size={20} strokeWidth={2.4} />
        Add a savings goal
      </Link>
    </div>
  );
}
