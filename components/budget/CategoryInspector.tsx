"use client";

import Link from "next/link";
import { Pencil, Pin, PlusCircle, Target } from "lucide-react";
import {
  cadenceShortLabel,
  ccPaymentRouting,
  categoryAvailable,
  categoryUnderfundedForMonth,
  findCategory,
  formatTargetDate,
  getAssigned,
  monthlyNeedForCategory,
  type CategoryTarget,
} from "@/lib/budget";
import { formatCurrency } from "@/lib/format";
import { useHorizonStore } from "@/components/store/HorizonStore";

// Whole calendar months between the two YYYY-MM keys (inclusive). Mirrors
// the `monthsUntilDueDate` helper in lib/budget but exposed as YYYY-MM
// since the Inspector only knows the active month key.
function monthsBetween(monthKey: string, dueIso: string): number {
  const [dueY, dueM] = dueIso.split("-").map(Number);
  const [curY, curM] = monthKey.split("-").map(Number);
  return Math.max(1, (dueY - curY) * 12 + (dueM - curM));
}

const TX_LIMIT = 12;

export default function CategoryInspector({
  categoryId,
  monthKey,
  onClose,
}: {
  categoryId: string;
  monthKey: string;
  onClose: () => void;
}) {
  const {
    groups,
    assignments,
    transactions,
    accounts,
    targets,
    pinnedCategoryIds,
    togglePin,
  } = useHorizonStore();
  const ccCtx = ccPaymentRouting(accounts, groups);
  const category = findCategory(groups, categoryId);

  if (!category) {
    return (
      <div className="px-6 py-12 text-center text-sm text-fg/55">
        That category no longer exists.{" "}
        <button
          type="button"
          onClick={onClose}
          className="text-accent font-bold"
        >
          Clear
        </button>
      </div>
    );
  }

  const assigned = getAssigned(assignments, monthKey, category.id);
  const available = categoryAvailable(
    category,
    assignments,
    transactions,
    monthKey,
    ccCtx,
  );
  const target = targets[category.id];
  const need = target
    ? monthlyNeedForCategory(
        category,
        target,
        assignments,
        transactions,
        monthKey,
        ccCtx,
      )
    : 0;
  const short = target
    ? categoryUnderfundedForMonth(
        category,
        target,
        assignments,
        transactions,
        monthKey,
        ccCtx,
      )
    : 0;
  const pinned = pinnedCategoryIds.includes(category.id);

  // Activity = the per-month signed sum of transactions tagged to this
  // category (splits and direct), expressed as outflow-positive for the
  // human label (e.g. "−$84.50 spent").
  let activity = 0;
  const recent: { id: string; date: string; payee: string; amount: number }[] = [];
  for (const t of transactions) {
    if (t.transferId) continue;
    const [y, m] = t.date.split("-").map(Number);
    const mk = `${y}-${String(m).padStart(2, "0")}`;
    if (mk !== monthKey) continue;
    if (t.splits && t.splits.length > 0) {
      for (const s of t.splits) {
        if (s.category === category.name) {
          activity += s.amount;
          recent.push({
            id: t.id,
            date: t.date,
            payee: t.payee,
            amount: s.amount,
          });
        }
      }
    } else if (t.category === category.name) {
      activity += t.amount;
      recent.push({
        id: t.id,
        date: t.date,
        payee: t.payee,
        amount: t.amount,
      });
    }
  }
  recent.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

  const moveAwayHref = `/budget/move?from=${encodeURIComponent(category.id)}&month=${monthKey}`;
  const fundHref =
    available < 0
      ? `/budget/move?to=${encodeURIComponent(category.id)}&month=${monthKey}&amount=${Math.abs(available).toFixed(2)}`
      : `/budget/move?to=${encodeURIComponent(category.id)}&month=${monthKey}`;
  const targetHref = `/goal/new?category=${encodeURIComponent(category.id)}`;

  return (
    <div className="px-4 py-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-fg/55">
            Category
          </p>
          <h2 className="text-2xl font-extrabold truncate">
            {category.emoji && (
              <span aria-hidden className="mr-1.5">
                {category.emoji}
              </span>
            )}
            {category.name}
          </h2>
        </div>
        <button
          type="button"
          onClick={() => togglePin(category.id)}
          aria-label={pinned ? `Unpin ${category.name}` : `Pin ${category.name}`}
          aria-pressed={pinned}
          className="hz-capsule grid h-9 w-9 place-items-center rounded-full"
        >
          <Pin
            size={16}
            strokeWidth={2}
            className={pinned ? "text-mint" : "text-fg/40"}
            fill={pinned ? "currentColor" : "transparent"}
          />
        </button>
      </div>

      <div className="rounded-2xl bg-card-elevated p-4">
        <dl className="grid grid-cols-3 gap-2 text-sm">
          <div>
            <dt className="text-[11px] uppercase tracking-wide text-fg/55">
              Assigned
            </dt>
            <dd className="mt-0.5 text-base font-bold tabular-nums">
              {formatCurrency(assigned)}
            </dd>
          </div>
          <div>
            <dt className="text-[11px] uppercase tracking-wide text-fg/55">
              Activity
            </dt>
            <dd
              className={`mt-0.5 text-base font-bold tabular-nums ${
                activity < 0 ? "text-rose-300" : "text-emerald-400"
              }`}
            >
              {activity === 0
                ? formatCurrency(0)
                : activity < 0
                  ? `−${formatCurrency(Math.abs(activity))}`
                  : `+${formatCurrency(activity)}`}
            </dd>
          </div>
          <div>
            <dt className="text-[11px] uppercase tracking-wide text-fg/55">
              Available
            </dt>
            <dd
              className={`mt-0.5 text-base font-bold tabular-nums ${
                available < 0 ? "text-rose-400" : "text-emerald-400"
              }`}
            >
              {formatCurrency(available)}
            </dd>
          </div>
        </dl>
      </div>

      <div className="flex flex-wrap gap-2">
        <Link
          href={fundHref}
          className="hz-pill hz-pill-accent flex-1 min-w-[160px] inline-flex items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-bold"
        >
          <PlusCircle size={16} strokeWidth={2.4} />
          <span>{available < 0 ? "Cover overspending" : "Fund"}</span>
        </Link>
        <Link
          href={moveAwayHref}
          className="hz-pill flex-1 min-w-[140px] inline-flex items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-bold"
        >
          <span>Move away</span>
        </Link>
      </div>

      <div className="rounded-2xl bg-card p-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-bold flex items-center gap-2">
            <Target size={14} strokeWidth={2.4} className={target ? "text-mint" : "text-fg/40"} />
            Target
          </p>
          <Link
            href={targetHref}
            aria-label={target ? "Edit target" : "Set target"}
            className="hz-capsule grid h-8 w-8 place-items-center rounded-full"
          >
            <Pencil size={14} strokeWidth={2.4} />
          </Link>
        </div>
        {target ? (
          target.paused ? (
            <p className="mt-2 text-sm text-fg/55">Paused.</p>
          ) : (
            <TargetSummary
              target={target}
              monthlyNeed={need}
              shortThisMonth={short}
              assignedThisMonth={assigned}
              monthKey={monthKey}
            />
          )
        ) : (
          <p className="mt-2 text-sm text-fg/55">
            No target set. Add one to see funding progress here.
          </p>
        )}
      </div>

      <div className="rounded-2xl bg-card overflow-hidden">
        <p className="px-4 pt-3 pb-1 text-xs font-medium uppercase tracking-wide text-fg/55">
          Recent activity
        </p>
        {recent.length === 0 ? (
          <p className="px-4 pb-3 text-sm text-fg/55">
            No transactions in this category this month.
          </p>
        ) : (
          <ul className="divide-y divide-fg/5">
            {recent.slice(0, TX_LIMIT).map((r) => {
              const isInflow = r.amount > 0;
              return (
                <li key={`${r.id}-${r.date}`} className="px-4 py-2.5">
                  <Link
                    href={`/spending/${r.id}`}
                    className="flex items-center justify-between gap-3"
                  >
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                      {r.payee}
                    </span>
                    <span
                      className={`text-sm font-bold tabular-nums ${
                        isInflow ? "text-emerald-400" : "text-fg"
                      }`}
                    >
                      {isInflow
                        ? `+${formatCurrency(r.amount)}`
                        : `−${formatCurrency(Math.abs(r.amount))}`}
                    </span>
                  </Link>
                  <p className="text-[11px] text-fg/45">{r.date}</p>
                </li>
              );
            })}
          </ul>
        )}
        {recent.length > TX_LIMIT && (
          <Link
            href={`/spending?category=${encodeURIComponent(category.name)}`}
            className="block border-t border-fg/5 px-4 py-2.5 text-center text-xs font-bold text-accent"
          >
            See all in Spending
          </Link>
        )}
      </div>
    </div>
  );
}

function TargetSummary({
  target,
  monthlyNeed,
  shortThisMonth,
  assignedThisMonth,
  monthKey,
}: {
  target: CategoryTarget;
  monthlyNeed: number;
  shortThisMonth: number;
  assignedThisMonth: number;
  monthKey: string;
}) {
  const onTrack = shortThisMonth <= 0;
  const reachedEarly = monthlyNeed <= 0;

  // Headline emphasises the per-month figure so the user can see at a
  // glance how much they need to assign this month — matching the YNAB
  // "Need this month" framing.
  const headline = reachedEarly
    ? "Goal already met for this month"
    : `Need ${formatCurrency(monthlyNeed)} this month`;
  const headlineTone = reachedEarly
    ? "text-mint"
    : onTrack
      ? "text-emerald-400"
      : "text-amber-400";

  let context: string | null = null;
  if (target.kind === "by-date" && !reachedEarly) {
    const monthsLeft = monthsBetween(monthKey, target.dueDate);
    const due = formatTargetDate(target.dueDate);
    context =
      monthsLeft === 1
        ? `Last month to hit ${formatCurrency(target.amount)} by ${due}`
        : `${monthsLeft} months left to hit ${formatCurrency(target.amount)} by ${due}`;
  } else if (target.kind === "refill") {
    context = `Refill the envelope to ${formatCurrency(target.amount)} each month`;
  } else if (target.kind === "set-aside") {
    context = `Set aside ${formatCurrency(target.amount)} per ${cadenceShortLabel(
      target.cadence,
    )}`;
  } else if (target.kind === "spending") {
    context = `Spending limit of ${formatCurrency(target.amount)} this month`;
  }

  // Spread of the per-month math: how much is in the assignment now and how
  // far it is from the target. Keeps the headline focused on the action.
  const detail = reachedEarly
    ? `Assigned ${formatCurrency(assignedThisMonth)} this month — already covers the goal.`
    : onTrack
      ? `Assigned ${formatCurrency(assignedThisMonth)} this month, meeting the ${formatCurrency(monthlyNeed)} need.`
      : `Assigned ${formatCurrency(assignedThisMonth)} of ${formatCurrency(monthlyNeed)} so far — ${formatCurrency(shortThisMonth)} short.`;

  const autoAdjustNote =
    target.kind === "by-date"
      ? "This number rebalances each month: missing a month bumps it up, getting ahead trims it down."
      : target.kind === "refill"
        ? "Refill grows when you spend out of the envelope and shrinks when carryover covers next month."
        : null;

  return (
    <div className="mt-2 space-y-1.5">
      <p className={`text-base font-extrabold tabular-nums ${headlineTone}`}>
        {headline}
      </p>
      {context && <p className="text-xs text-fg/65">{context}</p>}
      <p className="text-xs text-fg/55 tabular-nums">{detail}</p>
      {autoAdjustNote && (
        <p className="text-[11px] text-fg/45 italic">{autoAdjustNote}</p>
      )}
    </div>
  );
}
