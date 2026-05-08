// Savings goals are independent of budget categories — a simple ledger of
// "I'm saving up for X, here's how far along I am." Each contribution is a
// signed amount: positive deposits add to the saved total, negative ones
// (withdrawals) subtract. The running sum is the goal's current balance.

export type SavingsContribution = {
  id: string;
  // ISO YYYY-MM-DD when the deposit / withdrawal happened.
  date: string;
  // Signed amount: positive = deposit, negative = withdrawal.
  amount: number;
  note?: string;
};

export type SavingsGoal = {
  id: string;
  name: string;
  // Target dollar amount the user is saving toward. Always positive.
  targetAmount: number;
  // Optional ISO YYYY-MM-DD due date.
  dueDate?: string;
  // Optional emoji shown alongside the goal name.
  emoji?: string;
  notes?: string;
  // Append-only ledger of deposits and withdrawals, newest-first by
  // convention. The current balance is the sum of contribution amounts.
  contributions: SavingsContribution[];
  // ISO YYYY-MM-DD the goal was created — used as a sort fallback.
  createdAt: string;
};

export const sampleSavingsGoals: SavingsGoal[] = [];

export function savedAmount(goal: SavingsGoal): number {
  let total = 0;
  for (const c of goal.contributions) total += c.amount;
  // Round to cents to avoid floating-point drift after many entries.
  return Math.round(total * 100) / 100;
}

export function remainingAmount(goal: SavingsGoal): number {
  return Math.max(0, goal.targetAmount - savedAmount(goal));
}

export function progressPct(goal: SavingsGoal): number {
  if (goal.targetAmount <= 0) return 0;
  const pct = (savedAmount(goal) / goal.targetAmount) * 100;
  // Clamp so a goal that's been over-funded still shows a sensible bar; the
  // detail page can still surface the overage explicitly.
  return Math.max(0, Math.min(100, pct));
}

export function isReached(goal: SavingsGoal): boolean {
  return savedAmount(goal) >= goal.targetAmount && goal.targetAmount > 0;
}

// Days remaining until the due date, or null if undated. Negative when past
// due. Today counts as zero.
export function daysUntilDue(goal: SavingsGoal, today: Date = new Date()): number | null {
  if (!goal.dueDate) return null;
  const due = new Date(`${goal.dueDate}T00:00:00`);
  const startOfToday = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  );
  const ms = due.getTime() - startOfToday.getTime();
  return Math.round(ms / (1000 * 60 * 60 * 24));
}

// Suggested monthly contribution to hit the target by the due date. Null
// when there's no due date or the goal is already funded.
export function monthlyPaceNeeded(
  goal: SavingsGoal,
  today: Date = new Date(),
): number | null {
  if (!goal.dueDate) return null;
  const remaining = remainingAmount(goal);
  if (remaining <= 0) return null;
  const due = new Date(`${goal.dueDate}T00:00:00`);
  const monthsLeft =
    (due.getFullYear() - today.getFullYear()) * 12 +
    (due.getMonth() - today.getMonth());
  // Always at least one month so we don't divide by zero or go negative.
  const denom = Math.max(1, monthsLeft);
  return remaining / denom;
}

// Active goals first (ascending progress so the least-funded surfaces),
// then reached goals after.
export function sortGoalsByProgress(goals: SavingsGoal[]): SavingsGoal[] {
  return goals.slice().sort((a, b) => {
    const aReached = isReached(a);
    const bReached = isReached(b);
    if (aReached !== bReached) return aReached ? 1 : -1;
    const ap = progressPct(a);
    const bp = progressPct(b);
    if (ap !== bp) return ap - bp;
    // Earliest due date first as a tiebreaker; undated goals last.
    if (a.dueDate && b.dueDate) return a.dueDate < b.dueDate ? -1 : 1;
    if (a.dueDate) return -1;
    if (b.dueDate) return 1;
    return a.createdAt < b.createdAt ? -1 : 1;
  });
}

export type SavingsSummary = {
  count: number;
  totalSaved: number;
  totalTarget: number;
  reachedCount: number;
};

export function summarizeGoals(goals: SavingsGoal[]): SavingsSummary {
  let totalSaved = 0;
  let totalTarget = 0;
  let reached = 0;
  for (const g of goals) {
    totalSaved += savedAmount(g);
    totalTarget += g.targetAmount;
    if (isReached(g)) reached += 1;
  }
  return {
    count: goals.length,
    totalSaved,
    totalTarget,
    reachedCount: reached,
  };
}
