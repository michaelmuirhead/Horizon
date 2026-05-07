import type { Transaction } from "./transactions";
import type { Account } from "./accounts";
import {
  ASSET_ACCOUNT_TYPES,
  LIABILITY_ACCOUNT_TYPES,
  liveAccountBalance,
} from "./accounts";
import type { BudgetCategoryGroup } from "./budget";

export type CategoryShare = {
  name: string;
  spent: number;
};

export type IncomeSpendingPoint = {
  month: string;
  income: number;
  spending: number;
};

export type NetWorthPoint = {
  month: string;
  assets: number;
  debts: number;
};

const monthShortFmt = new Intl.DateTimeFormat("en-US", { month: "short" });
const monthLongFmt = new Intl.DateTimeFormat("en-US", {
  month: "long",
  year: "numeric",
});
const MS_PER_DAY = 1000 * 60 * 60 * 24;

function shortMonthLabel(year: number, monthIndex: number): string {
  return monthShortFmt.format(new Date(year, monthIndex, 1));
}

function longMonthLabel(year: number, monthIndex: number): string {
  return monthLongFmt.format(new Date(year, monthIndex, 1));
}

function parseIsoDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function txYearMonth(t: Transaction): { y: number; m: number } {
  const [y, m] = t.date.split("-").map(Number);
  return { y, m: m - 1 };
}

export function spendingBreakdownForMonth(
  transactions: Transaction[],
  groups: BudgetCategoryGroup[],
  year: number,
  monthIndex: number,
) {
  const inMonth = transactions.filter((t) => {
    if (t.isReadyToAssign) return false;
    if (t.transferId) return false;
    if (t.amount >= 0) return false;
    const { y, m } = txYearMonth(t);
    return y === year && m === monthIndex;
  });

  const spentByName = new Map<string, number>();
  for (const t of inMonth) {
    if (t.splits && t.splits.length > 0) {
      for (const s of t.splits) {
        if (s.amount >= 0) continue;
        spentByName.set(s.category, (spentByName.get(s.category) ?? 0) + -s.amount);
      }
      continue;
    }
    spentByName.set(t.category, (spentByName.get(t.category) ?? 0) + -t.amount);
  }

  // Render in budget order, then any orphaned categories last.
  const ordered: CategoryShare[] = [];
  for (const g of groups) {
    for (const c of g.categories) {
      const spent = spentByName.get(c.name);
      if (spent !== undefined && spent > 0) {
        ordered.push({ name: c.name, spent });
        spentByName.delete(c.name);
      }
    }
  }
  for (const [name, spent] of spentByName) {
    if (spent > 0) ordered.push({ name, spent });
  }
  ordered.sort((a, b) => b.spent - a.spent);

  const total = ordered.reduce((s, c) => s + c.spent, 0);
  return {
    month: longMonthLabel(year, monthIndex),
    total,
    categories: ordered,
  };
}

export function incomeVsSpending(
  transactions: Transaction[],
  endYear: number,
  endMonthIndex: number,
  monthsBack = 6,
): IncomeSpendingPoint[] {
  const points: IncomeSpendingPoint[] = [];
  for (let i = monthsBack - 1; i >= 0; i--) {
    const date = new Date(endYear, endMonthIndex - i, 1);
    const y = date.getFullYear();
    const m = date.getMonth();
    let income = 0;
    let spending = 0;
    for (const t of transactions) {
      const { y: ty, m: tm } = txYearMonth(t);
      if (ty !== y || tm !== m) continue;
      if (t.transferId) continue;
      if (t.isReadyToAssign && t.amount > 0) income += t.amount;
      else if (!t.isReadyToAssign && t.amount < 0) spending += -t.amount;
    }
    points.push({ month: shortMonthLabel(y, m), income, spending });
  }
  return points;
}

export function currentNetWorth(
  accounts: Account[],
  transactions: Transaction[],
) {
  let assets = 0;
  let debts = 0;
  for (const a of accounts) {
    if (a.closed) continue;
    const live = liveAccountBalance(a, transactions);
    if (ASSET_ACCOUNT_TYPES.has(a.type)) assets += live;
    else if (LIABILITY_ACCOUNT_TYPES.has(a.type)) debts += -live;
  }
  return { assets, debts };
}

export function netWorthHistory(
  accounts: Account[],
  transactions: Transaction[],
  endYear: number,
  endMonthIndex: number,
  monthsBack = 6,
): NetWorthPoint[] {
  const points: NetWorthPoint[] = [];
  for (let i = monthsBack - 1; i >= 0; i--) {
    const date = new Date(endYear, endMonthIndex - i, 1);
    const y = date.getFullYear();
    const m = date.getMonth();
    const endOfMonth = new Date(y, m + 1, 0);

    let assets = 0;
    let debts = 0;
    for (const a of accounts) {
      if (a.closed) continue;
      const txsByEnd = transactions.filter(
        (t) => t.account === a.name && parseIsoDate(t.date) <= endOfMonth,
      );
      const balanceAtMonthEnd =
        a.balance + txsByEnd.reduce((s, t) => s + t.amount, 0);
      if (ASSET_ACCOUNT_TYPES.has(a.type)) assets += balanceAtMonthEnd;
      else if (LIABILITY_ACCOUNT_TYPES.has(a.type))
        debts += -balanceAtMonthEnd;
    }
    points.push({ month: shortMonthLabel(y, m), assets, debts });
  }
  return points;
}

export type CategoryTrend = {
  name: string;
  byMonth: number[]; // length = monthsBack; oldest first
  total: number;
};

export function categorySpendingTrends(
  transactions: Transaction[],
  groups: BudgetCategoryGroup[],
  endYear: number,
  endMonthIndex: number,
  monthsBack = 6,
): { months: string[]; trends: CategoryTrend[] } {
  const months: { y: number; m: number; key: string; label: string }[] = [];
  for (let i = monthsBack - 1; i >= 0; i--) {
    const date = new Date(endYear, endMonthIndex - i, 1);
    const y = date.getFullYear();
    const m = date.getMonth();
    months.push({
      y,
      m,
      key: `${y}-${String(m + 1).padStart(2, "0")}`,
      label: shortMonthLabel(y, m),
    });
  }
  const allCategoryNames: string[] = [];
  const seen = new Set<string>();
  for (const g of groups) {
    for (const c of g.categories) {
      if (seen.has(c.name)) continue;
      seen.add(c.name);
      allCategoryNames.push(c.name);
    }
  }
  const trendMap = new Map<string, number[]>();
  for (const name of allCategoryNames) {
    trendMap.set(name, new Array(months.length).fill(0));
  }
  for (const t of transactions) {
    if (t.isReadyToAssign || t.transferId) continue;
    if (t.amount >= 0) continue;
    const { y, m } = txYearMonth(t);
    const idx = months.findIndex((mo) => mo.y === y && mo.m === m);
    if (idx < 0) continue;
    if (t.splits && t.splits.length > 0) {
      for (const s of t.splits) {
        if (s.amount >= 0) continue;
        if (!trendMap.has(s.category)) {
          trendMap.set(s.category, new Array(months.length).fill(0));
          allCategoryNames.push(s.category);
        }
        trendMap.get(s.category)![idx] += -s.amount;
      }
    } else {
      if (!trendMap.has(t.category)) {
        trendMap.set(t.category, new Array(months.length).fill(0));
        allCategoryNames.push(t.category);
      }
      trendMap.get(t.category)![idx] += -t.amount;
    }
  }
  const trends: CategoryTrend[] = allCategoryNames
    .map((name) => {
      const byMonth = trendMap.get(name)!;
      const total = byMonth.reduce((s, v) => s + v, 0);
      return { name, byMonth, total };
    })
    .filter((t) => t.total > 0)
    .sort((a, b) => b.total - a.total);
  return { months: months.map((mo) => mo.label), trends };
}

export type RangeTotals = {
  income: number;
  spending: number;
  net: number; // income - spending
  savingsRate: number; // 0..1; 0 when income is 0
};

export function rangeTotals(
  transactions: Transaction[],
  endYear: number,
  endMonthIndex: number,
  monthsBack = 6,
): RangeTotals {
  const points = incomeVsSpending(
    transactions,
    endYear,
    endMonthIndex,
    monthsBack,
  );
  let income = 0;
  let spending = 0;
  for (const p of points) {
    income += p.income;
    spending += p.spending;
  }
  const net = income - spending;
  const savingsRate = income > 0 ? Math.max(-1, net / income) : 0;
  return { income, spending, net, savingsRate };
}

export type PayeeSpend = {
  payee: string;
  byMonth: number[];
  total: number;
};

export function topSpendingPayees(
  transactions: Transaction[],
  endYear: number,
  endMonthIndex: number,
  monthsBack = 6,
): { months: string[]; entries: PayeeSpend[] } {
  const months: { y: number; m: number; label: string }[] = [];
  for (let i = monthsBack - 1; i >= 0; i--) {
    const date = new Date(endYear, endMonthIndex - i, 1);
    months.push({
      y: date.getFullYear(),
      m: date.getMonth(),
      label: shortMonthLabel(date.getFullYear(), date.getMonth()),
    });
  }
  const byPayee = new Map<string, number[]>();
  for (const t of transactions) {
    if (t.isReadyToAssign || t.transferId) continue;
    if (t.amount >= 0) continue; // outflows only
    const { y, m } = txYearMonth(t);
    const idx = months.findIndex((mo) => mo.y === y && mo.m === m);
    if (idx < 0) continue;
    const arr = byPayee.get(t.payee) ?? new Array(months.length).fill(0);
    arr[idx] += -t.amount;
    byPayee.set(t.payee, arr);
  }
  const entries: PayeeSpend[] = [];
  for (const [payee, byMonth] of byPayee) {
    const total = byMonth.reduce((s, v) => s + v, 0);
    if (total > 0) entries.push({ payee, byMonth, total });
  }
  entries.sort((a, b) => b.total - a.total);
  return { months: months.map((mo) => mo.label), entries };
}

export type IncomePayeeBreakdown = {
  payee: string;
  byMonth: number[];
  total: number;
};

export function incomeBreakdownByPayee(
  transactions: Transaction[],
  endYear: number,
  endMonthIndex: number,
  monthsBack = 6,
): { months: string[]; entries: IncomePayeeBreakdown[] } {
  const months: { y: number; m: number; label: string }[] = [];
  for (let i = monthsBack - 1; i >= 0; i--) {
    const date = new Date(endYear, endMonthIndex - i, 1);
    months.push({
      y: date.getFullYear(),
      m: date.getMonth(),
      label: shortMonthLabel(date.getFullYear(), date.getMonth()),
    });
  }
  const byPayee = new Map<string, number[]>();
  for (const t of transactions) {
    if (!t.isReadyToAssign || t.amount <= 0) continue;
    if (t.transferId) continue;
    const { y, m } = txYearMonth(t);
    const idx = months.findIndex((mo) => mo.y === y && mo.m === m);
    if (idx < 0) continue;
    const arr = byPayee.get(t.payee) ?? new Array(months.length).fill(0);
    arr[idx] += t.amount;
    byPayee.set(t.payee, arr);
  }
  const entries: IncomePayeeBreakdown[] = [];
  for (const [payee, byMonth] of byPayee) {
    const total = byMonth.reduce((s, v) => s + v, 0);
    if (total > 0) entries.push({ payee, byMonth, total });
  }
  entries.sort((a, b) => b.total - a.total);
  return { months: months.map((mo) => mo.label), entries };
}

export const AGE_OF_MONEY_MIN_OUTFLOWS = 10;

// FIFO-style: each spent dollar is matched to the oldest unconsumed inflow
// dollar; the average age (today minus inflow date) of the dollars spent in
// the most recent N outflows is the reported Age of Money.
export function ageOfMoneyDays(transactions: Transaction[]): number | null {
  const outflowsAsc = [...transactions]
    .filter((t) => !t.isReadyToAssign && t.amount < 0)
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  if (outflowsAsc.length < AGE_OF_MONEY_MIN_OUTFLOWS) return null;

  const inflowQueue = [...transactions]
    .filter((t) => t.isReadyToAssign && t.amount > 0)
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
    .map((t) => ({ remaining: t.amount, time: parseIsoDate(t.date).getTime() }));

  const recentIds = new Set(
    outflowsAsc.slice(-AGE_OF_MONEY_MIN_OUTFLOWS).map((t) => t.id),
  );

  let dollarDays = 0;
  let dollars = 0;
  let qIdx = 0;

  for (const out of outflowsAsc) {
    let need = -out.amount;
    const outTime = parseIsoDate(out.date).getTime();
    const isRecent = recentIds.has(out.id);
    while (need > 0 && qIdx < inflowQueue.length) {
      const inflow = inflowQueue[qIdx];
      const take = Math.min(need, inflow.remaining);
      if (isRecent) {
        const ageDays = Math.max(0, (outTime - inflow.time) / MS_PER_DAY);
        dollarDays += ageDays * take;
        dollars += take;
      }
      inflow.remaining -= take;
      need -= take;
      if (inflow.remaining <= 0) qIdx++;
    }
    if (need > 0) {
      // Outflow ran past available inflows; the "unfunded" portion has no
      // meaningful age, so it doesn't contribute to the average.
    }
  }

  if (dollars <= 0) return null;
  return Math.round(dollarDays / dollars);
}

export type AgeOfMoneySpend = {
  txId: string;
  date: string;
  payee: string;
  amount: number;
  averageAgeDays: number;
};

// Per-outflow age detail using the same FIFO matching as ageOfMoneyDays.
// Returns the most recent N outflows with their dollar-weighted average
// inflow age. Doesn't gate on a minimum count — callers decide whether to
// hide it.
export function ageOfMoneyByTransaction(
  transactions: Transaction[],
  recentN: number = AGE_OF_MONEY_MIN_OUTFLOWS,
): AgeOfMoneySpend[] {
  const outflowsAsc = [...transactions]
    .filter((t) => !t.isReadyToAssign && t.amount < 0 && !t.transferId)
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  if (outflowsAsc.length === 0) return [];

  const inflowQueue = [...transactions]
    .filter((t) => t.isReadyToAssign && t.amount > 0)
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
    .map((t) => ({ remaining: t.amount, time: parseIsoDate(t.date).getTime() }));

  const recentIds = new Set(outflowsAsc.slice(-recentN).map((t) => t.id));
  const ageById = new Map<string, { dollarDays: number; dollars: number }>();

  let qIdx = 0;
  for (const out of outflowsAsc) {
    let need = -out.amount;
    const outTime = parseIsoDate(out.date).getTime();
    const isRecent = recentIds.has(out.id);
    while (need > 0 && qIdx < inflowQueue.length) {
      const inflow = inflowQueue[qIdx];
      const take = Math.min(need, inflow.remaining);
      if (isRecent) {
        const ageDays = Math.max(0, (outTime - inflow.time) / MS_PER_DAY);
        const cur = ageById.get(out.id) ?? { dollarDays: 0, dollars: 0 };
        cur.dollarDays += ageDays * take;
        cur.dollars += take;
        ageById.set(out.id, cur);
      }
      inflow.remaining -= take;
      need -= take;
      if (inflow.remaining <= 0) qIdx++;
    }
  }

  const out: AgeOfMoneySpend[] = [];
  for (const tx of outflowsAsc.slice(-recentN)) {
    const acc = ageById.get(tx.id);
    if (!acc || acc.dollars <= 0) continue;
    out.push({
      txId: tx.id,
      date: tx.date,
      payee: tx.payee,
      amount: tx.amount,
      averageAgeDays: Math.round(acc.dollarDays / acc.dollars),
    });
  }
  // Newest first for display.
  return out.reverse();
}
