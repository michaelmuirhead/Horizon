import type { CcRoutingCtx, Transaction } from "./transactions";
import { txContributionsToCategory } from "./transactions";

// Build a CC routing context from the user's accounts and groups. Drops
// closed accounts because their payment categories no longer apply.
type CcAccountLike = {
  name: string;
  type: string;
  ccPaymentCategoryId?: string;
  closed?: boolean;
};

export function ccPaymentRouting(
  accounts: CcAccountLike[],
  groups: BudgetCategoryGroup[],
): CcRoutingCtx {
  const map = new Map<string, string>();
  for (const a of accounts) {
    if (a.type !== "credit-card" || !a.ccPaymentCategoryId || a.closed)
      continue;
    for (const g of groups) {
      const cat = g.categories.find((c) => c.id === a.ccPaymentCategoryId);
      if (cat) {
        map.set(a.name, cat.name);
        break;
      }
    }
  }
  return {
    ccPaymentCategoryFor: (name) => map.get(name) ?? null,
  };
}

export type BudgetCategory = {
  id: string;
  name: string;
  note?: string;
  hidden?: boolean;
  // A single grapheme — shown next to the category name in the budget grid
  // and pinned list. Empty/undefined means no emoji.
  emoji?: string;
};

export function visibleGroups(
  groups: BudgetCategoryGroup[],
): BudgetCategoryGroup[] {
  return groups
    .map((g) => ({
      ...g,
      categories: g.categories.filter((c) => !c.hidden),
    }))
    .filter((g) => g.categories.length > 0);
}

export type BudgetCategoryGroup = {
  id: string;
  name: string;
  categories: BudgetCategory[];
  emoji?: string;
};

// Per-month per-category dollar amount assigned in the budget.
// Outer key is a month key like "2026-05"; inner key is the category id.
export type Assignments = Record<string, Record<string, number>>;

const cat = (group: string, name: string): BudgetCategory => ({
  id: `${group}-${name}`.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
  name,
});

export const sampleBudget: BudgetCategoryGroup[] = [
  {
    id: "bills",
    name: "Bills",
    categories: [
      cat("Bills", "Rent/Mortgage"),
      cat("Bills", "Electric"),
      cat("Bills", "Water"),
      cat("Bills", "Internet"),
      cat("Bills", "Cellphone"),
    ],
  },
  {
    id: "frequent",
    name: "Frequent",
    categories: [
      cat("Frequent", "Groceries"),
      cat("Frequent", "Eating Out"),
      cat("Frequent", "Transportation"),
    ],
  },
  {
    id: "non-monthly",
    name: "Non-Monthly",
    categories: [
      cat("Non-Monthly", "Home Maintenance"),
      cat("Non-Monthly", "Auto Maintenance"),
      cat("Non-Monthly", "Gifts"),
    ],
  },
  {
    id: "goals",
    name: "Goals",
    categories: [
      cat("Goals", "Vacation"),
      cat("Goals", "Education"),
      cat("Goals", "Home Improvement"),
    ],
  },
  {
    id: "quality",
    name: "Quality of Life",
    categories: [
      cat("Quality", "Hobbies"),
      cat("Quality", "Entertainment"),
      cat("Quality", "Health & Wellness"),
    ],
  },
];

export const sampleAssignments: Assignments = {};

export const READY_TO_ASSIGN_CATEGORY = "Income: Ready to Assign";

export type Cadence = "weekly" | "monthly" | "yearly";

export type CategoryTarget =
  // "Set aside $X every {cadence}" — the monthly need is the amount converted
  // into a monthly-equivalent. Weekly multiplies by 52/12, yearly divides by 12.
  | {
      kind: "set-aside";
      amount: number;
      cadence: Cadence;
      paused?: boolean;
      autoFund?: boolean;
    }
  // "Refill the category up to $X each month" — only what's missing from the
  // start-of-month available counts as needed.
  | { kind: "refill"; amount: number; paused?: boolean; autoFund?: boolean }
  // "I want to spend $X each month" — same monthly need as set-aside-monthly,
  // but the subtitle frames it as actual-vs-target spending instead of
  // saving cadence.
  | { kind: "spending"; amount: number; paused?: boolean; autoFund?: boolean }
  // Sinking fund — "$X by Y", spread over the months remaining.
  | {
      kind: "by-date";
      amount: number;
      dueDate: string;
      paused?: boolean;
      autoFund?: boolean;
    };

export type CategoryTargets = Record<string, CategoryTarget>;

export function cadenceMultiplier(cadence: Cadence): number {
  if (cadence === "weekly") return 52 / 12;
  if (cadence === "yearly") return 1 / 12;
  return 1;
}

export function cadenceShortLabel(cadence: Cadence): string {
  if (cadence === "weekly") return "wk";
  if (cadence === "yearly") return "yr";
  return "mo";
}

export function monthKeyOf(year: number, monthIndex: number): string {
  return `${year}-${String(monthIndex + 1).padStart(2, "0")}`;
}

export function shiftMonthKey(monthKey: string, delta: number): string {
  const [y, m] = monthKey.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return monthKeyOf(d.getFullYear(), d.getMonth());
}

export function findCategory(
  groups: BudgetCategoryGroup[],
  categoryId: string,
): BudgetCategory | null {
  for (const g of groups) {
    for (const c of g.categories) {
      if (c.id === categoryId) return c;
    }
  }
  return null;
}

export function allCategoryNames(
  groups: BudgetCategoryGroup[] = sampleBudget,
): string[] {
  return groups.flatMap((g) =>
    g.categories.filter((c) => !c.hidden).map((c) => c.name),
  );
}

export function getAssigned(
  assignments: Assignments,
  monthKey: string,
  categoryId: string,
): number {
  return assignments[monthKey]?.[categoryId] ?? 0;
}

export function setAssigned(
  assignments: Assignments,
  monthKey: string,
  categoryId: string,
  amount: number,
): Assignments {
  const prevMonth = assignments[monthKey] ?? {};
  const nextMonth = { ...prevMonth };
  if (amount === 0) delete nextMonth[categoryId];
  else nextMonth[categoryId] = amount;

  const next = { ...assignments };
  if (Object.keys(nextMonth).length === 0) delete next[monthKey];
  else next[monthKey] = nextMonth;
  return next;
}

export function totalAssignedInMonth(
  assignments: Assignments,
  monthKey: string,
): number {
  const monthMap = assignments[monthKey];
  if (!monthMap) return 0;
  let total = 0;
  for (const v of Object.values(monthMap)) total += v;
  return total;
}

export function totalAssignedAllMonths(assignments: Assignments): number {
  let total = 0;
  for (const monthMap of Object.values(assignments)) {
    for (const v of Object.values(monthMap)) total += v;
  }
  return total;
}

// One step in a category's chronological rollup. inMonth is the balance
// during the month (can be negative if overspent); at month-end any negative
// is absorbed into overspend and the running balance resets to 0 before the
// next month — that's the rollover rule.
type CategoryMonthRollup = {
  monthKey: string;
  inMonth: number;
  overspend: number;
  endBalance: number;
};

function categoryRollups(
  category: BudgetCategory,
  assignments: Assignments,
  transactions: Transaction[],
  ctx?: CcRoutingCtx,
): CategoryMonthRollup[] {
  const months = new Set<string>();
  for (const [mk, monthMap] of Object.entries(assignments)) {
    if (monthMap[category.id] !== undefined) months.add(mk);
  }
  const txByMonth = new Map<string, number>();
  for (const t of transactions) {
    const contrib = txContributionsToCategory(t, category.name, ctx);
    if (contrib === 0) continue;
    const [y, m] = t.date.split("-").map(Number);
    const mk = monthKeyOf(y, m - 1);
    months.add(mk);
    txByMonth.set(mk, (txByMonth.get(mk) ?? 0) + contrib);
  }
  const sorted = [...months].sort();

  let balance = 0;
  const rollups: CategoryMonthRollup[] = [];
  for (const mk of sorted) {
    const assigned = assignments[mk]?.[category.id] ?? 0;
    const txSum = txByMonth.get(mk) ?? 0;
    balance += assigned + txSum;
    const inMonth = balance;
    let overspend = 0;
    if (balance < 0) {
      overspend = -balance;
      balance = 0;
    }
    rollups.push({ monthKey: mk, inMonth, overspend, endBalance: balance });
  }
  return rollups;
}

// Envelope balance at the given month: in-month value if the category had
// activity that month, else the carryover from the most recent prior month.
// Positive carryover persists; negative balances are absorbed into overspend
// at month-end (see readyToAssignAmount), so they do NOT bleed into the next
// month's available.
export function categoryAvailable(
  category: BudgetCategory,
  assignments: Assignments,
  transactions: Transaction[],
  monthKey: string,
  ctx?: CcRoutingCtx,
): number {
  const rollups = categoryRollups(category, assignments, transactions, ctx);
  if (rollups.length === 0) return 0;
  let priorEnd = 0;
  for (const r of rollups) {
    if (r.monthKey === monthKey) return r.inMonth;
    if (r.monthKey < monthKey) priorEnd = r.endBalance;
    else break;
  }
  return priorEnd;
}

// Available coming INTO this month — i.e. end-of-previous-month balance,
// after clamping. Useful for spreading a "by date" target's remaining need
// over the months left without double-counting this month's assignment.
export function categoryAvailableAtStart(
  category: BudgetCategory,
  assignments: Assignments,
  transactions: Transaction[],
  monthKey: string,
  ctx?: CcRoutingCtx,
): number {
  const rollups = categoryRollups(category, assignments, transactions, ctx);
  let priorEnd = 0;
  for (const r of rollups) {
    if (r.monthKey < monthKey) priorEnd = r.endBalance;
    else break;
  }
  return priorEnd;
}

function monthsUntilDueDate(dueDateIso: string, monthKey: string): number {
  const [dueY, dueM] = dueDateIso.split("-").map(Number);
  const [curY, curM] = monthKey.split("-").map(Number);
  // Both currentMonth and dueMonth are 1-indexed here. Diff in calendar months
  // including the current one — 1 means "this is the last chance".
  return Math.max(1, (dueY - curY) * 12 + (dueM - curM));
}

export function monthlyNeedForCategory(
  category: BudgetCategory,
  target: CategoryTarget,
  assignments: Assignments,
  transactions: Transaction[],
  monthKey: string,
  ctx?: CcRoutingCtx,
): number {
  if (target.kind === "set-aside") {
    return target.amount * cadenceMultiplier(target.cadence);
  }
  if (target.kind === "spending") {
    return target.amount;
  }
  const startAvailable = categoryAvailableAtStart(
    category,
    assignments,
    transactions,
    monthKey,
    ctx,
  );
  if (target.kind === "refill") {
    return Math.max(0, target.amount - startAvailable);
  }
  const remaining = Math.max(0, target.amount - startAvailable);
  const monthsLeft = monthsUntilDueDate(target.dueDate, monthKey);
  return remaining / monthsLeft;
}

export function categoryUnderfundedForMonth(
  category: BudgetCategory,
  target: CategoryTarget | undefined,
  assignments: Assignments,
  transactions: Transaction[],
  monthKey: string,
  ctx?: CcRoutingCtx,
): number {
  if (!target || target.paused) return 0;
  const need = monthlyNeedForCategory(
    category,
    target,
    assignments,
    transactions,
    monthKey,
    ctx,
  );
  const assignedThisMonth = getAssigned(assignments, monthKey, category.id);
  return Math.max(0, need - assignedThisMonth);
}

const targetDateFmt = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

export function formatTargetDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return targetDateFmt.format(new Date(y, m - 1, d));
}

export function totalUnderfundedForMonth(
  groups: BudgetCategoryGroup[],
  targets: CategoryTargets,
  assignments: Assignments,
  transactions: Transaction[],
  monthKey: string,
  ctx?: CcRoutingCtx,
): number {
  let total = 0;
  for (const g of groups) {
    for (const c of g.categories) {
      const target = targets[c.id];
      if (!target) continue;
      total += categoryUnderfundedForMonth(
        c,
        target,
        assignments,
        transactions,
        monthKey,
        ctx,
      );
    }
  }
  return total;
}

export function groupTotals(
  group: BudgetCategoryGroup,
  assignments: Assignments,
  transactions: Transaction[],
  monthKey: string,
  ctx?: CcRoutingCtx,
) {
  let assigned = 0;
  let available = 0;
  for (const c of group.categories) {
    assigned += getAssigned(assignments, monthKey, c.id);
    available += categoryAvailable(c, assignments, transactions, monthKey, ctx);
  }
  return { assigned, available };
}

export function totalOverspend(
  groups: BudgetCategoryGroup[],
  assignments: Assignments,
  transactions: Transaction[],
  ctx?: CcRoutingCtx,
): number {
  let total = 0;
  for (const g of groups) {
    for (const c of g.categories) {
      for (const r of categoryRollups(c, assignments, transactions, ctx)) {
        total += r.overspend;
      }
    }
  }
  return total;
}

export function readyToAssignAmount(
  transactions: Transaction[],
  assignments: Assignments,
  groups: BudgetCategoryGroup[],
  ctx?: CcRoutingCtx,
): number {
  const inflow = transactions
    .filter((t) => t.isReadyToAssign)
    .reduce((sum, t) => sum + t.amount, 0);
  return (
    inflow -
    totalAssignedAllMonths(assignments) -
    totalOverspend(groups, assignments, transactions, ctx)
  );
}

export function totalSpentInMonth(
  transactions: Transaction[],
  year: number,
  monthIndex: number,
): number {
  const sum = transactions
    .filter((t) => {
      if (t.isReadyToAssign) return false;
      const [y, m] = t.date.split("-").map(Number);
      return y === year && m - 1 === monthIndex;
    })
    .reduce((s, t) => s + t.amount, 0);
  // Outflows are negative; "spent" reads more naturally as a positive number.
  // Clamp at 0 so a refund-heavy month doesn't surface as "negative spent".
  return Math.max(0, -sum);
}
