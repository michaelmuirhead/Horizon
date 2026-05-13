"use client";

import Link from "next/link";
import { useState } from "react";
import { ChevronDown, ChevronRight, PiggyBank } from "lucide-react";
import type { SavingsGoal } from "@/lib/savingsGoals";
import { savedAmount, sortGoalsByProgress } from "@/lib/savingsGoals";
import { formatCurrency } from "@/lib/format";

// Mirrors AccountGroupSection's collapsible look so the Savings Goals
// block reads as a peer of the account-type groups (Cash, Savings,
// Loans, …) on the Accounts tab. Each row links to the goal's detail
// page; tapping the header just toggles the collapse.
export default function SavingsGoalsGroupSection({
  goals,
}: {
  goals: SavingsGoal[];
}) {
  const [expanded, setExpanded] = useState(true);
  if (goals.length === 0) return null;
  const sorted = sortGoalsByProgress(goals);
  const total = sorted.reduce((s, g) => s + savedAmount(g), 0);

  return (
    <section>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="flex w-full items-center gap-3 px-1 py-2 text-left"
      >
        <ChevronDown
          size={18}
          strokeWidth={2.5}
          className={`transition-transform ${expanded ? "" : "-rotate-90"}`}
        />
        <h2 className="flex-1 text-xl font-bold">Savings Goals</h2>
        <span className="text-base font-semibold text-fg/85 tabular-nums">
          {formatCurrency(total)}
        </span>
      </button>
      {expanded && (
        <ul className="mt-2 flex flex-col gap-2">
          {sorted.map((g) => {
            const saved = savedAmount(g);
            const pct =
              g.targetAmount > 0
                ? Math.min(100, Math.round((saved / g.targetAmount) * 100))
                : 0;
            return (
              <li key={g.id}>
                <Link
                  href={`/savings/${g.id}`}
                  className="flex items-center gap-3 rounded-2xl bg-card-elevated px-3 py-3"
                >
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-emerald-900/30 text-emerald-300">
                    {g.emoji ? (
                      <span className="text-base">{g.emoji}</span>
                    ) : (
                      <PiggyBank size={18} strokeWidth={2.4} />
                    )}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-base font-bold">{g.name}</p>
                    <p className="mt-0.5 text-xs text-fg/55 tabular-nums">
                      {formatCurrency(saved)} of{" "}
                      {formatCurrency(g.targetAmount)} · {pct}%
                    </p>
                  </div>
                  <ChevronRight size={16} className="text-fg/55 shrink-0" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
