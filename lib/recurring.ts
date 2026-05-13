import type { ScheduledTransaction } from "./scheduled";
import { isTransferSchedule } from "./scheduled";
import type { Transaction } from "./transactions";

// Broader recurring-pattern detection than lib/subscriptions: handles
// inflows (paychecks, transfers in) as well as outflows, and any
// cadence in { weekly, biweekly, monthly } rather than just monthly.
// Used to suggest "track this as a scheduled transaction" candidates.

export type RecurringCadence = "weekly" | "biweekly" | "monthly";

export type RecurringCandidate = {
  direction: "income" | "expense";
  payee: string;
  // Category from the latest matching transaction — what we'd seed the
  // scheduled-form prefill with.
  category: string;
  account: string;
  averageAmount: number; // positive magnitude
  hits: number;
  lastSeen: string;
  cadence: RecurringCadence;
  // 0..1; higher = more confidently recurring. Drives the sort order.
  confidence: number;
};

const MIN_HITS = 3;
// Drift bands. Subscriptions are usually exact; paychecks vary slightly
// (taxes, overtime). 8% covers both without admitting one-off purchases.
const AMOUNT_TOLERANCE = 0.08;
// Cadence buckets. Each is a window around the canonical interval —
// generous enough to absorb weekend-skipped payments and the variable
// month length but tight enough not to overlap.
const CADENCE_BUCKETS: ReadonlyArray<{
  cadence: RecurringCadence;
  low: number;
  high: number;
}> = [
  { cadence: "weekly", low: 5, high: 9 },
  { cadence: "biweekly", low: 12, high: 16 },
  { cadence: "monthly", low: 26, high: 35 },
];

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

export function detectRecurring(
  transactions: Transaction[],
): RecurringCandidate[] {
  type Group = {
    payee: string;
    category: string;
    account: string;
    direction: "income" | "expense";
    txs: { date: string; amount: number }[];
  };
  // Key by (lowercased payee, direction) so a refund / one-off inflow
  // doesn't pollute the outflow group for the same vendor.
  const groups = new Map<string, Group>();
  for (const t of transactions) {
    if (t.isReadyToAssign) continue;
    if (t.transferId) continue;
    if (t.splits && t.splits.length > 0) continue;
    if (t.amount === 0) continue;
    const direction: "income" | "expense" = t.amount > 0 ? "income" : "expense";
    const key = `${direction}|${t.payee.trim().toLowerCase()}`;
    if (key === "" || t.payee.trim() === "") continue;
    const group = groups.get(key) ?? {
      payee: t.payee,
      category: t.category,
      account: t.account,
      direction,
      txs: [],
    };
    group.txs.push({ date: t.date, amount: Math.abs(t.amount) });
    // Track the most-recent category + account; users sometimes
    // recategorize a payee and the latest pick is the best seed.
    if (t.date >= (group.txs[group.txs.length - 1]?.date ?? "")) {
      group.category = t.category;
      group.account = t.account;
    }
    groups.set(key, group);
  }

  const out: RecurringCandidate[] = [];
  for (const group of groups.values()) {
    if (group.txs.length < MIN_HITS) continue;
    const sorted = group.txs.slice().sort((a, b) => (a.date < b.date ? -1 : 1));
    const amounts = sorted.map((t) => t.amount);
    const med = median(amounts);
    if (med <= 0) continue;
    const stable = amounts.every(
      (a) => Math.abs(a - med) <= med * AMOUNT_TOLERANCE,
    );
    if (!stable) continue;

    const gaps: number[] = [];
    for (let i = 1; i < sorted.length; i++) {
      gaps.push(daysBetween(sorted[i - 1].date, sorted[i].date));
    }
    if (gaps.length === 0) continue;

    // Find the cadence bucket that catches the most gaps. Need at least
    // 60% of gaps in-bucket to call it recurring; under that, the
    // pattern is too noisy to suggest.
    let best: { cadence: RecurringCadence; hits: number } | null = null;
    for (const bucket of CADENCE_BUCKETS) {
      const hits = gaps.filter((g) => g >= bucket.low && g <= bucket.high).length;
      if (best === null || hits > best.hits) {
        best = { cadence: bucket.cadence, hits };
      }
    }
    if (!best || best.hits / gaps.length < 0.6) continue;

    // Confidence blends cadence regularity with amount stability.
    const cadenceRegularity = best.hits / gaps.length;
    const amountSpread =
      Math.max(...amounts) - Math.min(...amounts);
    const amountStability = 1 - Math.min(1, amountSpread / med);
    const confidence = cadenceRegularity * 0.65 + amountStability * 0.35;

    out.push({
      direction: group.direction,
      payee: group.payee,
      category: group.category,
      account: group.account,
      averageAmount: Math.round(med * 100) / 100,
      hits: sorted.length,
      lastSeen: sorted[sorted.length - 1].date,
      cadence: best.cadence,
      confidence: Math.round(confidence * 100) / 100,
    });
  }
  out.sort((a, b) => b.confidence - a.confidence);
  return out;
}

// Returns true when the candidate is already covered by an existing
// scheduled transaction. Two kinds of match:
//
//   1. A transaction-kind schedule whose payee matches the candidate's
//      (case-insensitive, same cadence). This is the standard
//      "Netflix-style" subscription case.
//   2. A transfer-kind schedule whose to/from account contains the
//      candidate's payee AND whose amount is within 5% of the
//      candidate's average. Catches debt-payment transfers ("Pay
//      Mortgage from Checking") that already cover what the user is
//      seeing as recurring outflows.
//
// The amount tolerance on transfers is deliberately tight — name
// containment alone false-positives when a user has both subscription
// charges to "Chase" and a separate transfer to "Chase Visa". Pairing
// it with amount makes the match meaningful.
const TRANSFER_AMOUNT_TOLERANCE = 0.05;

export function isAlreadyScheduled(
  candidate: RecurringCandidate,
  schedules: ScheduledTransaction[],
): boolean {
  const needle = candidate.payee.trim().toLowerCase();
  for (const s of schedules) {
    if (s.cadence !== candidate.cadence) continue;
    if (isTransferSchedule(s)) {
      const to = s.toAccount.trim().toLowerCase();
      const from = s.fromAccount.trim().toLowerCase();
      const nameMatch =
        to === needle ||
        from === needle ||
        to.includes(needle) ||
        from.includes(needle);
      if (!nameMatch) continue;
      const amtDiff = Math.abs(s.amount - candidate.averageAmount);
      if (amtDiff > candidate.averageAmount * TRANSFER_AMOUNT_TOLERANCE) {
        continue;
      }
      return true;
    }
    if (s.payee.trim().toLowerCase() !== needle) continue;
    return true;
  }
  return false;
}
