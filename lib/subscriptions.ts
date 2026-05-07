import type { Transaction } from "./transactions";

export type SubscriptionCandidate = {
  payee: string;
  category: string;
  // Median of the last few amounts (positive magnitude). Banks sometimes
  // bill subscriptions with a $0.01 difference month-over-month so we use
  // the median rather than requiring exact matches.
  averageAmount: number;
  // Number of transactions that fed this candidate (>= MIN_HITS).
  hits: number;
  // ISO of the most recent matching transaction.
  lastSeen: string;
  // Estimated cadence — only "monthly" today, expandable later.
  cadence: "monthly";
};

const MIN_HITS = 3;
const AMOUNT_TOLERANCE = 0.05; // 5% drift between charges still counts
const CADENCE_DAYS_LOW = 26;
const CADENCE_DAYS_HIGH = 35;

function median(nums: number[]): number {
  const sorted = nums.slice().sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

function daysBetween(aIso: string, bIso: string): number {
  const a = new Date(aIso).getTime();
  const b = new Date(bIso).getTime();
  return Math.abs(b - a) / 86_400_000;
}

// Detects payees that look like recurring monthly subscriptions: same
// payee, similar amount, charged at roughly monthly intervals, and at
// least MIN_HITS occurrences in the source data. We deliberately scope to
// outflows on the parent transaction (no splits, no transfers, no RTA
// inflows) — subscriptions are simple, single-line debits.
export function detectSubscriptions(
  transactions: Transaction[],
): SubscriptionCandidate[] {
  type Group = {
    payee: string;
    category: string;
    txs: { date: string; amount: number }[];
  };
  // Group by lowercased payee — bank exports often vary capitalisation
  // ("KROGER #455" vs "Kroger #455") between months.
  const byPayee = new Map<string, Group>();
  for (const t of transactions) {
    if (t.isReadyToAssign) continue;
    if (t.transferId) continue;
    if (t.splits && t.splits.length > 0) continue;
    if (t.amount >= 0) continue;
    const key = t.payee.trim().toLowerCase();
    if (key === "") continue;
    const group = byPayee.get(key) ?? {
      payee: t.payee,
      category: t.category,
      txs: [],
    };
    group.txs.push({ date: t.date, amount: -t.amount });
    byPayee.set(key, group);
  }

  const out: SubscriptionCandidate[] = [];
  for (const group of byPayee.values()) {
    if (group.txs.length < MIN_HITS) continue;
    const sorted = group.txs.slice().sort((a, b) => (a.date < b.date ? -1 : 1));
    const amounts = sorted.map((t) => t.amount);
    const med = median(amounts);
    if (med <= 0) continue;
    // Skip if any charge is way off the median (probably one-off purchases
    // grouped with the recurring ones).
    const drift = amounts.every(
      (a) => Math.abs(a - med) <= med * AMOUNT_TOLERANCE,
    );
    if (!drift) continue;
    // Check spacing between consecutive charges. Allow ~monthly gaps; if
    // most gaps fall in the band we treat it as monthly.
    const gaps: number[] = [];
    for (let i = 1; i < sorted.length; i++) {
      gaps.push(daysBetween(sorted[i - 1].date, sorted[i].date));
    }
    const monthlyHits = gaps.filter(
      (g) => g >= CADENCE_DAYS_LOW && g <= CADENCE_DAYS_HIGH,
    ).length;
    if (monthlyHits < gaps.length * 0.6) continue;

    out.push({
      payee: group.payee,
      category: group.category,
      averageAmount: Math.round(med * 100) / 100,
      hits: sorted.length,
      lastSeen: sorted[sorted.length - 1].date,
      cadence: "monthly",
    });
  }

  // Most expensive first — typically what the user wants to review for
  // cancellation.
  out.sort((a, b) => b.averageAmount - a.averageAmount);
  return out;
}

export function totalMonthlySubscriptions(
  candidates: SubscriptionCandidate[],
): number {
  return candidates.reduce((sum, c) => sum + c.averageAmount, 0);
}
