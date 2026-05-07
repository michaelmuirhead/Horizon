import type { Account } from "./accounts";
import {
  ASSET_ACCOUNT_TYPES,
  LIABILITY_ACCOUNT_TYPES,
  liveAccountBalance,
} from "./accounts";
import type { Transaction } from "./transactions";
import {
  isTransferSchedule,
  upcomingOccurrences,
  type ScheduledTransaction,
} from "./scheduled";

export type CashFlowPoint = {
  date: string; // ISO YYYY-MM-DD
  balance: number;
};

export type CashFlowProjection = {
  series: CashFlowPoint[];
  // Quick stats so the UI can show "you'll dip to $X on Y" at a glance.
  start: number;
  end: number;
  low: { date: string; balance: number };
};

function toIso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function liquidBalance(accounts: Account[], transactions: Transaction[]): number {
  let total = 0;
  for (const a of accounts) {
    if (a.closed || a.tracking) continue;
    if (!ASSET_ACCOUNT_TYPES.has(a.type)) continue;
    total += liveAccountBalance(a, transactions);
  }
  return total;
}

// Walks forward from today, applying every scheduled occurrence in the
// window to a running asset-only balance. The result is a daily series
// suitable for a sparkline plus the lowest projected dip — the headline
// number for a cash-flow projection ("how tight does it get?").
export function projectCashFlow(
  accounts: Account[],
  transactions: Transaction[],
  scheds: ScheduledTransaction[],
  daysAhead: number,
  todayIso: string,
): CashFlowProjection {
  const start = liquidBalance(accounts, transactions);
  const end = new Date(todayIso);
  end.setDate(end.getDate() + daysAhead);
  const endIso = toIso(end);

  // Build a quick lookup of asset-account names to know which transfer legs
  // matter for cash. Any account that isn't an open asset is ignored.
  const assetNames = new Set<string>();
  const liabilityNames = new Set<string>();
  for (const a of accounts) {
    if (a.closed) continue;
    if (a.tracking) continue;
    if (ASSET_ACCOUNT_TYPES.has(a.type)) assetNames.add(a.name);
    else if (LIABILITY_ACCOUNT_TYPES.has(a.type)) liabilityNames.add(a.name);
  }

  const occurrences = upcomingOccurrences(scheds, todayIso, endIso);
  const dailyDelta = new Map<string, number>();
  for (const occ of occurrences) {
    const s = occ.scheduled;
    let delta = 0;
    if (isTransferSchedule(s)) {
      const fromAsset = assetNames.has(s.fromAccount);
      const toAsset = assetNames.has(s.toAccount);
      if (fromAsset && !toAsset) delta = -s.amount;
      else if (!fromAsset && toAsset) delta = s.amount;
      // Asset↔asset and liability↔liability net to zero on cash.
    } else {
      if (assetNames.has(s.account)) delta = s.amount;
    }
    if (delta === 0) continue;
    dailyDelta.set(occ.date, (dailyDelta.get(occ.date) ?? 0) + delta);
  }

  const series: CashFlowPoint[] = [];
  let running = start;
  let low = { date: todayIso, balance: start };
  const cursor = new Date(todayIso);
  for (let i = 0; i <= daysAhead; i++) {
    const iso = toIso(cursor);
    running += dailyDelta.get(iso) ?? 0;
    series.push({ date: iso, balance: running });
    if (running < low.balance) low = { date: iso, balance: running };
    cursor.setDate(cursor.getDate() + 1);
  }

  return {
    series,
    start,
    end: series[series.length - 1].balance,
    low,
  };
}
