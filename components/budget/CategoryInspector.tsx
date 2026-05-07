"use client";

import Link from "next/link";
import { Pencil, Pin, PlusCircle, Target } from "lucide-react";
import {
  ccPaymentRouting,
  categoryAvailable,
  categoryUnderfundedForMonth,
  findCategory,
  getAssigned,
  monthlyNeedForCategory,
} from "@/lib/budget";
import { formatCurrency } from "@/lib/format";
import { useHorizonStore } from "@/components/store/HorizonStore";

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
          className="grid h-9 w-9 place-items-center rounded-full bg-card-elevated"
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
          className="flex-1 min-w-[160px] inline-flex items-center justify-center gap-2 rounded-full bg-accent px-4 py-2.5 text-sm font-bold text-fg"
        >
          <PlusCircle size={16} strokeWidth={2.4} />
          {available < 0 ? "Cover overspending" : "Fund"}
        </Link>
        <Link
          href={moveAwayHref}
          className="flex-1 min-w-[140px] inline-flex items-center justify-center gap-2 rounded-full bg-card-elevated px-4 py-2.5 text-sm font-bold"
        >
          Move away
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
            className="grid h-8 w-8 place-items-center rounded-full bg-card-elevated"
          >
            <Pencil size={14} strokeWidth={2.4} />
          </Link>
        </div>
        {target ? (
          target.paused ? (
            <p className="mt-2 text-sm text-fg/55">Paused.</p>
          ) : (
            <p
              className={`mt-2 text-sm tabular-nums ${
                short > 0 ? "text-amber-400" : "text-fg/70"
              }`}
            >
              {short > 0
                ? `${formatCurrency(short)} short of ${formatCurrency(need)} this month`
                : `Funded for this month (${formatCurrency(need)})`}
            </p>
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
