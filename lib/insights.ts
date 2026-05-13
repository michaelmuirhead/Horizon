// Weekly-cadence summary cards for the home tab. Pure analysis over the
// transaction ledger — no scheduling, no notifications. Each insight
// renders as a small card with a one-line title and a couple of stat
// pairs. Surface a handful at most; otherwise the home tab becomes a
// reading exercise.

import type { Transaction } from "./transactions";

export type InsightKind =
  | "weekly-net"
  | "top-category"
  | "biggest-expense"
  | "scheduled-vs-actual";

export type WeeklyInsight = {
  id: string;
  kind: InsightKind;
  title: string;
  // Stats render as a two-column list under the title.
  stats: { label: string; value: string; tone?: "good" | "bad" | "neutral" }[];
  // Free-form follow-up sentence. Omit when the stats already tell it.
  footnote?: string;
};

// Resolves the start of the ISO week (Monday 00:00) that contains `today`,
// in the user's local timezone. We use Monday-start consistently with the
// rest of the app's month/week framing.
function startOfWeek(today: Date = new Date()): Date {
  const d = new Date(today);
  d.setHours(0, 0, 0, 0);
  // getDay: 0 = Sunday … 6 = Saturday. Shift so Monday = 0.
  const dayIdx = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - dayIdx);
  return d;
}

function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function inRange(tIso: string, start: Date, end: Date): boolean {
  // ISO date string comparison is byte-correct because YYYY-MM-DD sorts
  // lexicographically — handy and avoids re-parsing every transaction.
  return tIso >= isoDate(start) && tIso < isoDate(end);
}

// Transfers and ready-to-assign rows aren't real spending and shouldn't
// affect insight cards. Keep this filter co-located so the rules don't
// drift between insights.
function isSpendingTx(t: Transaction): boolean {
  if (t.isReadyToAssign) return false;
  if (t.transferId) return false;
  return true;
}

function currency(amount: number): string {
  const sign = amount < 0 ? "−" : amount > 0 ? "+" : "";
  return `${sign}$${Math.abs(amount).toFixed(2)}`;
}

const dayFmt = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
});

export function generateWeeklyInsights(
  transactions: Transaction[],
  today: Date = new Date(),
): WeeklyInsight[] {
  const thisWeekStart = startOfWeek(today);
  const nextWeekStart = new Date(thisWeekStart);
  nextWeekStart.setDate(nextWeekStart.getDate() + 7);
  const lastWeekStart = new Date(thisWeekStart);
  lastWeekStart.setDate(lastWeekStart.getDate() - 7);

  const thisWeek = transactions.filter(
    (t) => isSpendingTx(t) && inRange(t.date, thisWeekStart, nextWeekStart),
  );
  const lastWeek = transactions.filter(
    (t) => isSpendingTx(t) && inRange(t.date, lastWeekStart, thisWeekStart),
  );

  const insights: WeeklyInsight[] = [];

  // 1) Weekly net — income minus expenses this week, with a delta vs
  //    last week when last week's data exists.
  if (thisWeek.length > 0) {
    const thisNet = thisWeek.reduce((s, t) => s + t.amount, 0);
    const lastNet = lastWeek.reduce((s, t) => s + t.amount, 0);
    const delta = thisNet - lastNet;
    const stats: WeeklyInsight["stats"] = [
      {
        label: "Net this week",
        value: currency(thisNet),
        tone: thisNet >= 0 ? "good" : "bad",
      },
    ];
    if (lastWeek.length > 0) {
      stats.push({
        label: "vs last week",
        value: currency(delta),
        tone: delta >= 0 ? "good" : "bad",
      });
    }
    insights.push({
      id: "weekly-net",
      kind: "weekly-net",
      title: thisNet >= 0 ? "You're net positive" : "You're net negative",
      stats,
    });
  }

  // 2) Top expense category — by absolute spend (outflows only). Skip
  //    when there's a tie at zero or the user only has income.
  const byCategory = new Map<string, number>();
  for (const t of thisWeek) {
    if (t.amount >= 0) continue;
    const cats: { name: string; amount: number }[] =
      t.splits && t.splits.length > 0
        ? t.splits.map((s) => ({ name: s.category, amount: s.amount }))
        : [{ name: t.category, amount: t.amount }];
    for (const c of cats) {
      if (c.amount >= 0) continue;
      byCategory.set(c.name, (byCategory.get(c.name) ?? 0) + -c.amount);
    }
  }
  if (byCategory.size > 0) {
    const ranked = Array.from(byCategory.entries()).sort(
      (a, b) => b[1] - a[1],
    );
    const [topName, topAmount] = ranked[0];
    const totalSpend = ranked.reduce((s, [, v]) => s + v, 0);
    const sharePct = Math.round((topAmount / totalSpend) * 100);
    insights.push({
      id: "top-category",
      kind: "top-category",
      title: `Most spent on ${topName}`,
      stats: [
        { label: "Total", value: currency(-topAmount), tone: "bad" },
        { label: "Share of spend", value: `${sharePct}%` },
      ],
    });
  }

  // 3) Biggest single expense — only worth surfacing when there's an
  //    outlier; otherwise it's noise. Threshold: > 1.5× the median
  //    outflow this week.
  const outflows = thisWeek.filter((t) => t.amount < 0);
  if (outflows.length >= 2) {
    const amounts = outflows.map((t) => -t.amount).sort((a, b) => a - b);
    const median =
      amounts.length % 2 === 0
        ? (amounts[amounts.length / 2 - 1] + amounts[amounts.length / 2]) / 2
        : amounts[Math.floor(amounts.length / 2)];
    const biggest = outflows.reduce(
      (b, t) => (Math.abs(t.amount) > Math.abs(b.amount) ? t : b),
      outflows[0],
    );
    if (Math.abs(biggest.amount) > median * 1.5) {
      const day = dayFmt.format(new Date(biggest.date));
      insights.push({
        id: "biggest-expense",
        kind: "biggest-expense",
        title: `Biggest charge: ${biggest.payee}`,
        stats: [
          {
            label: day,
            value: currency(biggest.amount),
            tone: "bad",
          },
          {
            label: "Category",
            value: biggest.category,
          },
        ],
      });
    }
  }

  return insights;
}
