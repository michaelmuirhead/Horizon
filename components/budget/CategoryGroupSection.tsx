"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, Pin, Target } from "lucide-react";
import type { BudgetCategory, BudgetCategoryGroup } from "@/lib/budget";
import {
  cadenceShortLabel,
  categoryAvailable,
  categoryUnderfundedForMonth,
  ccPaymentRouting,
  formatTargetDate,
  getAssigned,
  groupTotals,
} from "@/lib/budget";
import { formatCurrency } from "@/lib/format";
import { useHorizonStore } from "@/components/store/HorizonStore";
import AvailablePill from "./AvailablePill";
import AssignedCell from "./AssignedCell";

function targetSubtitle(
  category: BudgetCategory,
  ctx: {
    targets: ReturnType<typeof useHorizonStore>["targets"];
    assignments: ReturnType<typeof useHorizonStore>["assignments"];
    transactions: ReturnType<typeof useHorizonStore>["transactions"];
    monthKey: string;
  },
): { text: string; underfunded: boolean } | null {
  const target = ctx.targets[category.id];
  if (!target) return null;
  if (target.paused) {
    return { text: "Paused", underfunded: false };
  }
  const underfunded = categoryUnderfundedForMonth(
    category,
    target,
    ctx.assignments,
    ctx.transactions,
    ctx.monthKey,
  );
  if (target.kind === "set-aside") {
    const cadence = cadenceShortLabel(target.cadence);
    return underfunded > 0
      ? { text: `${formatCurrency(underfunded)} short`, underfunded: true }
      : {
          text: `Funded · ${formatCurrency(target.amount)}/${cadence}`,
          underfunded: false,
        };
  }
  if (target.kind === "refill") {
    return underfunded > 0
      ? {
          text: `${formatCurrency(underfunded)} short to refill`,
          underfunded: true,
        }
      : {
          text: `Refilled · ${formatCurrency(target.amount)}/mo`,
          underfunded: false,
        };
  }
  if (target.kind === "spending") {
    // Spent so far this month, by combining splits + non-split outflows.
    let spent = 0;
    for (const t of ctx.transactions) {
      if (t.isReadyToAssign || t.transferId) continue;
      const [y, m] = t.date.split("-").map(Number);
      const mk = `${y}-${String(m).padStart(2, "0")}`;
      if (mk !== ctx.monthKey) continue;
      if (t.splits && t.splits.length > 0) {
        for (const s of t.splits) {
          if (s.category === category.name && s.amount < 0) spent += -s.amount;
        }
      } else if (t.category === category.name && t.amount < 0) {
        spent += -t.amount;
      }
    }
    const overspent = spent > target.amount;
    return {
      text: overspent
        ? `${formatCurrency(spent - target.amount)} over · ${formatCurrency(spent)} of ${formatCurrency(target.amount)}`
        : `${formatCurrency(spent)} of ${formatCurrency(target.amount)} this month`,
      underfunded: overspent,
    };
  }
  const due = formatTargetDate(target.dueDate);
  return underfunded > 0
    ? {
        text: `${formatCurrency(underfunded)} short for ${due}`,
        underfunded: true,
      }
    : { text: `On track for ${due}`, underfunded: false };
}

export default function CategoryGroupSection({
  group,
  monthKey,
  onSelectCategory,
  selectedCategoryId,
}: {
  group: BudgetCategoryGroup;
  monthKey: string;
  // When set, tapping a category's name opens it in a side inspector
  // instead of being purely informational. Used by the iPad two-pane Budget.
  onSelectCategory?: (categoryId: string) => void;
  selectedCategoryId?: string;
}) {
  const [expanded, setExpanded] = useState(true);
  const {
    transactions,
    assignments,
    pinnedCategoryIds,
    targets,
    accounts,
    groups,
    setAssignment,
    togglePin,
  } = useHorizonStore();
  const ccCtx = ccPaymentRouting(accounts, groups);
  const { assigned, available } = groupTotals(
    group,
    assignments,
    transactions,
    monthKey,
    ccCtx,
  );

  return (
    <section>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="flex w-full items-center gap-3 bg-card px-4 py-4 text-left"
      >
        <ChevronDown
          size={16}
          strokeWidth={2.5}
          className={`transition-transform shrink-0 ${
            expanded ? "" : "-rotate-90"
          }`}
        />
        <h2 className="flex-1 text-xl font-bold">
          {group.emoji && (
            <span aria-hidden className="mr-1.5">
              {group.emoji}
            </span>
          )}
          {group.name}
        </h2>
        <div className="w-24 text-right">
          <p className="text-xs font-medium text-fg/70">Assigned</p>
          <p className="text-base font-bold tabular-nums">
            {formatCurrency(assigned)}
          </p>
        </div>
        <div className="w-24 text-right">
          <p className="text-xs font-medium text-fg/70">Available</p>
          <p
            className={`text-base font-bold tabular-nums ${
              available < 0 ? "text-rose-400" : ""
            }`}
          >
            {formatCurrency(available)}
          </p>
        </div>
      </button>

      {expanded && (
        <ul className="hz-fade-in">
          {group.categories.map((cat, i) => {
            const pinned = pinnedCategoryIds.includes(cat.id);
            const target = targets[cat.id];
            const subtitle = targetSubtitle(cat, {
              targets,
              assignments,
              transactions,
              monthKey,
            });
            const targetHref = `/goal/new?category=${encodeURIComponent(cat.id)}`;
            return (
              <li
                key={cat.id}
                className={`flex items-center gap-2 px-4 py-4 ${
                  selectedCategoryId === cat.id
                    ? "bg-accent/15"
                    : "bg-list-row"
                } ${
                  i < group.categories.length - 1
                    ? "border-b border-fg/5"
                    : ""
                }`}
              >
                {onSelectCategory ? (
                  <button
                    type="button"
                    onClick={() => onSelectCategory(cat.id)}
                    aria-pressed={selectedCategoryId === cat.id}
                    className="flex-1 min-w-0 text-left"
                  >
                    <span className="block text-base font-semibold truncate">
                      {cat.emoji && (
                        <span aria-hidden className="mr-1.5">
                          {cat.emoji}
                        </span>
                      )}
                      {cat.name}
                    </span>
                    {subtitle && (
                      <span
                        className={`mt-0.5 block text-xs truncate ${
                          subtitle.underfunded
                            ? "text-amber-400"
                            : "text-fg/55"
                        }`}
                      >
                        {subtitle.text}
                      </span>
                    )}
                  </button>
                ) : (
                  <div className="flex-1 min-w-0">
                    <span className="block text-base font-semibold truncate">
                      {cat.emoji && (
                        <span aria-hidden className="mr-1.5">
                          {cat.emoji}
                        </span>
                      )}
                      {cat.name}
                    </span>
                    {subtitle && (
                      <span
                        className={`mt-0.5 block text-xs truncate ${
                          subtitle.underfunded
                            ? "text-amber-400"
                            : "text-fg/55"
                        }`}
                      >
                        {subtitle.text}
                      </span>
                    )}
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => togglePin(cat.id)}
                  aria-label={pinned ? `Unpin ${cat.name}` : `Pin ${cat.name}`}
                  aria-pressed={pinned}
                  className="grid h-7 w-7 place-items-center"
                >
                  <Pin
                    size={14}
                    strokeWidth={2}
                    className={pinned ? "text-mint" : "text-fg/30"}
                    fill={pinned ? "currentColor" : "transparent"}
                  />
                </button>
                <Link
                  href={targetHref}
                  aria-label={
                    target
                      ? `Edit target for ${cat.name}`
                      : `Set target for ${cat.name}`
                  }
                  className="grid h-7 w-7 place-items-center"
                >
                  <Target
                    size={14}
                    strokeWidth={2}
                    className={target ? "text-mint" : "text-fg/30"}
                  />
                </Link>
                <AssignedCell
                  value={getAssigned(assignments, monthKey, cat.id)}
                  ariaLabel={`Assigned to ${cat.name}`}
                  onCommit={(next) => setAssignment(monthKey, cat.id, next)}
                />
                {(() => {
                  const av = categoryAvailable(
                    cat,
                    assignments,
                    transactions,
                    monthKey,
                    ccCtx,
                  );
                  // When overspent, the tap target jumps to the move form
                  // pre-pointed AT this category with the deficit amount —
                  // a one-tap "cover overspending" shortcut.
                  const href =
                    av < 0
                      ? `/budget/move?to=${encodeURIComponent(cat.id)}&month=${monthKey}&amount=${Math.abs(av).toFixed(2)}`
                      : `/budget/move?from=${encodeURIComponent(cat.id)}&month=${monthKey}`;
                  const ariaLabel =
                    av < 0
                      ? `Cover overspending in ${cat.name}`
                      : `Move money for ${cat.name}`;
                  return (
                    <Link href={href} aria-label={ariaLabel} className="w-24 text-right">
                      <AvailablePill amount={av} />
                    </Link>
                  );
                })()}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
