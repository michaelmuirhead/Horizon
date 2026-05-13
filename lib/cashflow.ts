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

// Average daily net cash flow from the last `lookbackDays` of history,
// EXCLUDING transactions whose payee matches a scheduled row (we don't
// want to double-count those — projectCashFlow already applies the
// schedule). Returns 0 when there isn't enough history to be meaningful.
//
// Used as a "baseline drift" on long-horizon forecasts so the chart
// doesn't go flat between scheduled events on months 4..12 (where
// real-life day-to-day spending dominates and the schedule alone is
// over-optimistic).
export function baselineDailyDrift(
  accounts: Account[],
  transactions: Transaction[],
  scheds: ScheduledTransaction[],
  todayIso: string,
  lookbackDays = 90,
): number {
  if (lookbackDays <= 0) return 0;
  const cutoffDate = new Date(todayIso);
  cutoffDate.setDate(cutoffDate.getDate() - lookbackDays);
  const cutoffIso = toIso(cutoffDate);

  const assetNames = new Set<string>();
  for (const a of accounts) {
    if (a.closed || a.tracking) continue;
    if (ASSET_ACCOUNT_TYPES.has(a.type)) assetNames.add(a.name);
  }
  const scheduledPayees = new Set<string>();
  for (const s of scheds) {
    if (isTransferSchedule(s)) continue;
    if (!s.payee) continue;
    scheduledPayees.add(s.payee.trim().toLowerCase());
  }

  let net = 0;
  let countedDays = 0;
  const seenDates = new Set<string>();
  for (const t of transactions) {
    if (t.transferId) continue;
    if (t.isReadyToAssign) continue;
    if (t.date < cutoffIso || t.date > todayIso) continue;
    if (!assetNames.has(t.account)) continue;
    if (scheduledPayees.has(t.payee.trim().toLowerCase())) continue;
    net += t.amount;
    seenDates.add(t.date);
  }
  countedDays = Math.max(1, lookbackDays);
  // We deliberately divide by the FULL lookback window, not just days
  // with activity — sparse weekends should pull the average down, not
  // get rounded out.
  void seenDates;
  return net / countedDays;
}

// Walks forward from today, applying every scheduled occurrence in the
// window to a running asset-only balance, optionally layered with a
// per-day baseline drift derived from history. The result is a daily
// series suitable for a sparkline plus the lowest projected dip — the
// headline number for a cash-flow projection ("how tight does it get?").
export function projectCashFlow(
  accounts: Account[],
  transactions: Transaction[],
  scheds: ScheduledTransaction[],
  daysAhead: number,
  todayIso: string,
  // 0 = scheduled-only (the previous behavior); pass the output of
  // baselineDailyDrift to layer in everyday spending.
  baselineDrift: number = 0,
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
    if (i > 0) {
      // Apply the baseline drift before scheduled deltas so day-0 reads
      // exactly the current liquid balance (no surprise jump on the
      // first cell of the chart).
      running += baselineDrift;
    }
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
