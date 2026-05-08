import Link from "next/link";
import { CalendarDays, ChevronRight, PartyPopper, PiggyBank } from "lucide-react";
import {
  daysUntilDue,
  isReached,
  progressPct,
  remainingAmount,
  savedAmount,
  type SavingsGoal,
} from "@/lib/savingsGoals";
import { formatCurrency } from "@/lib/format";

function formatDueLabel(goal: SavingsGoal): string | null {
  if (!goal.dueDate) return null;
  const days = daysUntilDue(goal);
  if (days === null) return null;
  if (days < 0) return `${Math.abs(days)}d overdue`;
  if (days === 0) return "Due today";
  if (days < 31) return `${days}d left`;
  // For longer horizons, show the actual date so the user can see it.
  const d = new Date(`${goal.dueDate}T00:00:00`);
  return d.toLocaleDateString(undefined, {
    month: "short",
    year: "numeric",
  });
}

export default function SavingsGoalRow({ goal }: { goal: SavingsGoal }) {
  const saved = savedAmount(goal);
  const remaining = remainingAmount(goal);
  const pct = progressPct(goal);
  const reached = isReached(goal);
  const dueLabel = formatDueLabel(goal);

  return (
    <Link
      href={`/savings/${goal.id}`}
      className="block rounded-2xl bg-card-elevated px-4 py-3.5 ring-1 ring-accent/10"
    >
      <div className="flex items-center gap-3">
        <span
          className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${
            reached
              ? "bg-emerald-900/40 text-emerald-300"
              : "bg-accent/20 text-accent"
          }`}
        >
          {reached ? (
            <PartyPopper size={18} strokeWidth={2.4} />
          ) : (
            <PiggyBank size={18} strokeWidth={2.4} />
          )}
        </span>
        <div className="flex-1 min-w-0">
          <p className="flex items-center gap-2 truncate text-base font-bold">
            {goal.emoji && <span aria-hidden>{goal.emoji}</span>}
            {goal.name}
          </p>
          <p className="text-xs text-fg/55">
            {formatCurrency(saved)} of {formatCurrency(goal.targetAmount)}
          </p>
        </div>
        <span
          className={`text-base font-bold tabular-nums ${
            reached ? "text-emerald-400" : "text-fg/85"
          }`}
        >
          {Math.round(pct)}%
        </span>
        <ChevronRight size={16} className="text-fg/55" />
      </div>

      <div className="mt-2 h-2 overflow-hidden rounded-full bg-card">
        <div
          className={`h-full ${reached ? "bg-emerald-400" : "bg-accent"}`}
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="mt-2 flex items-center justify-between text-xs">
        <span className="text-fg/55 tabular-nums">
          {reached
            ? "Goal reached"
            : `${formatCurrency(remaining)} to go`}
        </span>
        {dueLabel && (
          <span className="inline-flex items-center gap-1 text-fg/55">
            <CalendarDays size={11} strokeWidth={2.4} />
            {dueLabel}
          </span>
        )}
      </div>
    </Link>
  );
}
