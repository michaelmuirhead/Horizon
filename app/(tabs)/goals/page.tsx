"use client";

import Link from "next/link";
import { Suspense, useMemo, useState } from "react";
import { ArrowDownAZ, ArrowDownNarrowWide, BarChart3, Pause, PartyPopper, Pencil, Target } from "lucide-react";
import SubpageHeader from "@/components/layout/SubpageHeader";
import { useHorizonStore } from "@/components/store/HorizonStore";
import {
  cadenceShortLabel,
  categoryAvailable,
  categoryUnderfundedForMonth,
  ccPaymentRouting,
  formatTargetDate,
  monthKeyOf,
  monthlyNeedForCategory,
  type BudgetCategory,
  type CategoryTarget,
} from "@/lib/budget";
import { formatCurrency } from "@/lib/format";

type Sort = "shortfall" | "progress" | "name";

type GoalRow = {
  category: BudgetCategory;
  target: CategoryTarget;
  available: number;
  monthlyNeed: number;
  shortfall: number;
  progressPct: number;
};

export default function GoalsPage() {
  return (
    <Suspense fallback={null}>
      <Goals />
    </Suspense>
  );
}

function Goals() {
  const { groups, targets, assignments, transactions, accounts } =
    useHorizonStore();
  const [sort, setSort] = useState<Sort>("shortfall");
  const ccCtx = ccPaymentRouting(accounts, groups);
  const now = new Date();
  const monthKey = monthKeyOf(now.getFullYear(), now.getMonth());

  const rows = useMemo<GoalRow[]>(() => {
    const out: GoalRow[] = [];
    for (const g of groups) {
      for (const c of g.categories) {
        const target = targets[c.id];
        if (!target) continue;
        const available = categoryAvailable(
          c,
          assignments,
          transactions,
          monthKey,
          ccCtx,
        );
        const monthlyNeed = monthlyNeedForCategory(
          c,
          target,
          assignments,
          transactions,
          monthKey,
          ccCtx,
        );
        const shortfall = target.paused
          ? 0
          : categoryUnderfundedForMonth(
              c,
              target,
              assignments,
              transactions,
              monthKey,
              ccCtx,
            );
        // Progress reads differently per kind; use monthly need as the
        // denominator everywhere so the row's percent is comparable.
        const progressPct = (() => {
          if (target.paused) return 0;
          if (target.kind === "spending") {
            // For spending limits, "progress" is "how much spent of the cap".
            let spent = 0;
            for (const t of transactions) {
              if (t.isReadyToAssign || t.transferId) continue;
              const [y, m] = t.date.split("-").map(Number);
              const mk = `${y}-${String(m).padStart(2, "0")}`;
              if (mk !== monthKey) continue;
              if (t.splits && t.splits.length > 0) {
                for (const s of t.splits) {
                  if (s.category === c.name && s.amount < 0) spent += -s.amount;
                }
              } else if (t.category === c.name && t.amount < 0) {
                spent += -t.amount;
              }
            }
            return target.amount > 0
              ? Math.min(100, Math.round((spent / target.amount) * 100))
              : 0;
          }
          if (monthlyNeed <= 0) return 100;
          const fundedThisMonth = monthlyNeed - shortfall;
          return Math.max(
            0,
            Math.min(100, Math.round((fundedThisMonth / monthlyNeed) * 100)),
          );
        })();
        out.push({
          category: c,
          target,
          available,
          monthlyNeed,
          shortfall,
          progressPct,
        });
      }
    }
    return out;
  }, [groups, targets, assignments, transactions, monthKey, ccCtx]);

  const sortedRows = useMemo(() => {
    const copy = rows.slice();
    if (sort === "name") {
      copy.sort((a, b) =>
        a.category.name.toLowerCase() < b.category.name.toLowerCase() ? -1 : 1,
      );
    } else if (sort === "progress") {
      copy.sort((a, b) => b.progressPct - a.progressPct);
    } else {
      copy.sort((a, b) => b.shortfall - a.shortfall);
    }
    return copy;
  }, [rows, sort]);

  const totalShortfall = rows.reduce((s, r) => s + r.shortfall, 0);
  const fullyFunded = rows.filter(
    (r) => !r.target.paused && r.shortfall === 0 && r.target.kind !== "spending",
  ).length;
  const paused = rows.filter((r) => r.target.paused).length;

  return (
    <>
      <SubpageHeader title="Goals" backHref="/budget" />
      <div className="px-4 pt-2 pb-10 space-y-3">
        <div className="rounded-2xl bg-card p-4">
          <div className="grid grid-cols-3 gap-2 text-sm">
            <div>
              <p className="text-[11px] uppercase tracking-wide text-fg/55">
                Goals
              </p>
              <p className="mt-0.5 text-base font-bold tabular-nums">
                {rows.length}
              </p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wide text-fg/55">
                Funded
              </p>
              <p className="mt-0.5 text-base font-bold tabular-nums text-emerald-400">
                {fullyFunded}
              </p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wide text-fg/55">
                Short
              </p>
              <p
                className={`mt-0.5 text-base font-bold tabular-nums ${
                  totalShortfall > 0 ? "text-amber-400" : "text-fg/85"
                }`}
              >
                {formatCurrency(totalShortfall)}
              </p>
            </div>
          </div>
          {paused > 0 && (
            <p className="mt-2 text-[11px] text-fg/45">
              {paused} paused {paused === 1 ? "goal" : "goals"} not counted in
              shortfall.
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="text-fg/55">Sort:</span>
          {([
            { value: "shortfall", label: "Most short", Icon: ArrowDownNarrowWide },
            { value: "progress", label: "Most funded", Icon: BarChart3 },
            { value: "name", label: "Name", Icon: ArrowDownAZ },
          ] as const).map(({ value, label, Icon }) => (
            <button
              key={value}
              type="button"
              onClick={() => setSort(value)}
              aria-pressed={sort === value}
              className={`inline-flex items-center gap-1 rounded-full px-3 py-1 font-semibold ${
                sort === value
                  ? "bg-accent text-fg"
                  : "bg-card-elevated text-fg/70"
              }`}
            >
              <Icon size={12} strokeWidth={2.4} />
              {label}
            </button>
          ))}
        </div>

        {rows.length === 0 ? (
          <div className="rounded-2xl bg-card px-5 py-12 text-center text-sm text-fg/55">
            No targets yet. Set one from a category in the Budget tab to see
            it here.
          </div>
        ) : (
          <ul className="space-y-2">
            {sortedRows.map((r) => (
              <GoalCard key={r.category.id} row={r} />
            ))}
          </ul>
        )}
      </div>
    </>
  );
}

function GoalCard({ row }: { row: GoalRow }) {
  const { category, target, available, monthlyNeed, shortfall, progressPct } =
    row;
  const editHref = `/goal/new?category=${encodeURIComponent(category.id)}`;
  const fundHref = `/budget/move?to=${encodeURIComponent(category.id)}`;
  const isSpending = target.kind === "spending";
  const reached =
    !target.paused && shortfall === 0 && !isSpending && progressPct >= 100;
  const overSpent = isSpending && progressPct >= 100;
  const subtitle = (() => {
    if (target.paused) return "Paused";
    if (target.kind === "set-aside") {
      return `${formatCurrency(target.amount)}/${cadenceShortLabel(target.cadence)}`;
    }
    if (target.kind === "refill") return `Refill to ${formatCurrency(target.amount)}/mo`;
    if (target.kind === "spending") return `Cap of ${formatCurrency(target.amount)}/mo`;
    return `${formatCurrency(target.amount)} by ${formatTargetDate(target.dueDate)}`;
  })();

  return (
    <li className="rounded-2xl bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-base font-bold truncate">
            {category.emoji && <span aria-hidden>{category.emoji}</span>}
            {category.name}
            {target.paused && (
              <Pause size={14} className="text-fg/45 shrink-0" />
            )}
          </p>
          <p className="mt-0.5 text-xs text-fg/55 truncate">{subtitle}</p>
        </div>
        <Link
          href={editHref}
          aria-label={`Edit ${category.name} target`}
          className="grid h-8 w-8 place-items-center rounded-full bg-card-elevated"
        >
          <Pencil size={14} strokeWidth={2.4} />
        </Link>
      </div>

      <div className="mt-3 h-2 overflow-hidden rounded-full bg-card-elevated">
        <div
          className={`h-full ${
            target.paused
              ? "bg-white/20"
              : overSpent
                ? "bg-rose-400"
                : reached
                  ? "bg-mint"
                  : "bg-accent"
          }`}
          style={{ width: `${progressPct}%` }}
        />
      </div>

      <div className="mt-2 flex items-center justify-between text-xs">
        <span
          className={`tabular-nums ${
            shortfall > 0
              ? "text-amber-400"
              : overSpent
                ? "text-rose-300"
                : "text-fg/70"
          }`}
        >
          {target.paused
            ? "—"
            : isSpending
              ? `${progressPct}% of cap`
              : shortfall > 0
                ? `${formatCurrency(shortfall)} short of ${formatCurrency(monthlyNeed)}`
                : reached
                  ? "Funded for this month"
                  : `${progressPct}% funded`}
        </span>
        {!target.paused && shortfall > 0 ? (
          <Link
            href={fundHref}
            className="inline-flex items-center gap-1 rounded-full bg-accent/15 px-3 py-1 font-bold text-accent"
          >
            <Target size={12} strokeWidth={2.4} />
            Fund
          </Link>
        ) : reached ? (
          <span className="inline-flex items-center gap-1 text-mint font-semibold">
            <PartyPopper size={12} strokeWidth={2.4} />
            Reached
          </span>
        ) : null}
      </div>

      {!target.paused && available !== 0 && (
        <p className="mt-1.5 text-[11px] text-fg/45 tabular-nums">
          Available now: {formatCurrency(available)}
        </p>
      )}
    </li>
  );
}
