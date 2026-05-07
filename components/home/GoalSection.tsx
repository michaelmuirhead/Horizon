"use client";

import Link from "next/link";
import { PartyPopper, Pencil, PlusCircle } from "lucide-react";
import CollapsibleCard from "./CollapsibleCard";
import GoalIllustration from "./GoalIllustration";
import { useHorizonStore } from "@/components/store/HorizonStore";
import {
  type BudgetCategory,
  type CategoryTarget,
  cadenceShortLabel,
  categoryAvailable,
  categoryUnderfundedForMonth,
  ccPaymentRouting,
  formatTargetDate,
  monthKeyOf,
  monthlyNeedForCategory,
} from "@/lib/budget";
import { formatCurrency } from "@/lib/format";

export default function GoalSection() {
  const { groups, targets, assignments, transactions, accounts } =
    useHorizonStore();
  const ccCtx = ccPaymentRouting(accounts, groups);

  // First non-paused category (in budget order) that has a target.
  let featured: { category: BudgetCategory; target: CategoryTarget } | null =
    null;
  for (const g of groups) {
    for (const c of g.categories) {
      const t = targets[c.id];
      if (t && !t.paused) {
        featured = { category: c, target: t };
        break;
      }
    }
    if (featured) break;
  }

  if (!featured) {
    return (
      <CollapsibleCard title="Current Goal">
        <div className="flex flex-col items-center gap-3 text-center">
          <GoalIllustration />
          <h3 className="text-lg font-bold">What are you saving for?</h3>
          <p className="text-sm text-fg/70 px-2">
            Pick one category to track. We&rsquo;ll show your progress and
            celebrate when you reach your target.
          </p>
          <Link
            href="/goal/new"
            className="mt-2 flex items-center gap-2 text-accent text-base font-bold"
          >
            <PlusCircle size={22} />
            Add Goal
          </Link>
        </div>
      </CollapsibleCard>
    );
  }

  const { category, target } = featured;
  const now = new Date();
  const currentMonthKey = monthKeyOf(now.getFullYear(), now.getMonth());
  const available = Math.max(
    0,
    categoryAvailable(
      category,
      assignments,
      transactions,
      currentMonthKey,
      ccCtx,
    ),
  );
  const monthlyNeed = monthlyNeedForCategory(
    category,
    target,
    assignments,
    transactions,
    currentMonthKey,
    ccCtx,
  );
  const underfunded = categoryUnderfundedForMonth(
    category,
    target,
    assignments,
    transactions,
    currentMonthKey,
    ccCtx,
  );

  const editHref = `/goal/new?category=${encodeURIComponent(category.id)}`;

  let progressNumerator: number;
  let progressDenominator: number;
  let subtitle: string;
  let footer: string;
  if (target.kind === "set-aside") {
    const assignedThisMonth = monthlyNeed - underfunded;
    progressNumerator = Math.max(0, assignedThisMonth);
    progressDenominator = monthlyNeed;
    subtitle = `${formatCurrency(progressNumerator)} of ${formatCurrency(monthlyNeed)} this month · ${formatCurrency(target.amount)}/${cadenceShortLabel(target.cadence)}`;
    footer =
      underfunded > 0
        ? `${formatCurrency(underfunded)} needed this month`
        : "Funded for this month";
  } else if (target.kind === "refill") {
    progressNumerator = available;
    progressDenominator = target.amount;
    subtitle = `${formatCurrency(available)} of ${formatCurrency(target.amount)} this month`;
    footer =
      underfunded > 0
        ? `${formatCurrency(underfunded)} needed to refill`
        : "Refilled for this month";
  } else if (target.kind === "spending") {
    let spent = 0;
    for (const t of transactions) {
      if (t.isReadyToAssign || t.transferId) continue;
      const [y, m] = t.date.split("-").map(Number);
      const mk = `${y}-${String(m).padStart(2, "0")}`;
      if (mk !== currentMonthKey) continue;
      if (t.splits && t.splits.length > 0) {
        for (const s of t.splits) {
          if (s.category === category.name && s.amount < 0) spent += -s.amount;
        }
      } else if (t.category === category.name && t.amount < 0) {
        spent += -t.amount;
      }
    }
    progressNumerator = spent;
    progressDenominator = target.amount;
    subtitle = `${formatCurrency(spent)} of ${formatCurrency(target.amount)} spent`;
    footer =
      spent > target.amount
        ? `${formatCurrency(spent - target.amount)} over for this month`
        : `${formatCurrency(target.amount - spent)} left to spend`;
  } else {
    progressNumerator = available;
    progressDenominator = target.amount;
    subtitle = `${formatCurrency(available)} of ${formatCurrency(target.amount)} by ${formatTargetDate(target.dueDate)}`;
    footer =
      underfunded > 0
        ? `${formatCurrency(monthlyNeed)}/mo to stay on track`
        : "On track for the due date";
  }

  const pct =
    progressDenominator > 0
      ? Math.min(
          100,
          Math.round((progressNumerator / progressDenominator) * 100),
        )
      : 0;
  const reached = progressNumerator >= progressDenominator;
  // "Reached" only counts as a celebration for funding-style targets — a
  // spending target hitting 100% means the budget's used up, not earned.
  const celebrate = reached && target.kind !== "spending";

  return (
    <CollapsibleCard title="Current Goal">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-base font-bold truncate">{category.name}</p>
          <p className="mt-1 text-sm text-fg/70">{subtitle}</p>
        </div>
        <Link
          href={editHref}
          aria-label="Edit target"
          className="grid h-9 w-9 place-items-center rounded-full bg-card-elevated"
        >
          <Pencil size={16} strokeWidth={2.4} />
        </Link>
      </div>

      <div className="mt-4 h-3 overflow-hidden rounded-full bg-card-elevated">
        <div
          className={`h-full ${
            celebrate ? "bg-mint hz-pulse-mint" : reached ? "bg-mint" : "bg-accent"
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>

      <p className="mt-2 text-sm text-fg/70">{footer}</p>

      {celebrate && (
        <div className="mt-3 flex items-center gap-2 rounded-2xl bg-mint/15 px-3 py-2 text-mint hz-fade-in">
          <PartyPopper size={18} strokeWidth={2.4} />
          <p className="text-sm font-bold">Goal reached — nice work!</p>
        </div>
      )}
    </CollapsibleCard>
  );
}
