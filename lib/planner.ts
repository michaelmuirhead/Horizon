export type PlannerEntry = {
  id: string;
  label: string;
  // Signed: positive = income, negative = expense.
  amount: number;
  date: string; // ISO YYYY-MM-DD
};

export const samplePlannerEntries: PlannerEntry[] = [];

export function plannerRunningTotal(entries: PlannerEntry[]): number {
  return entries.reduce((sum, e) => sum + e.amount, 0);
}

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

const weekdayFormatter = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
});

const dayHeaderFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
});

export function formatPlannerDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return dateFormatter.format(new Date(y, m - 1, d));
}

export function formatPlannerWeekday(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return weekdayFormatter.format(new Date(y, m - 1, d));
}

export function formatPlannerDayHeader(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return dayHeaderFormatter.format(new Date(y, m - 1, d));
}

export type PlannerSummary = {
  income: number;
  expense: number; // stored as a positive magnitude
  balance: number;
};

export function summarizeEntries(entries: PlannerEntry[]): PlannerSummary {
  let income = 0;
  let expense = 0;
  for (const e of entries) {
    if (e.amount > 0) income += e.amount;
    else expense += -e.amount;
  }
  return { income, expense, balance: income - expense };
}

export type PlannerDayRow = {
  entry: PlannerEntry;
  // Cumulative balance after this entry posted, walking the month in
  // chronological (then id-stable) order.
  running: number;
};

export type PlannerDayGroup = {
  date: string; // ISO YYYY-MM-DD
  rows: PlannerDayRow[]; // displayed in the user's drag-defined order
  dayTotal: number; // signed net for the day
};

// Build day-grouped rows for a month-scoped slice of entries. Groups come
// back newest-day first; rows within each day preserve the source array
// order so user drag-reorder is the source of truth (Array.prototype.sort
// is stable, so equal-date rows keep input order). Running balance walks
// chronologically across day boundaries so it tracks the new order
// immediately after a drop. Pass `openingBalance` to seed the running
// tally — used to carry the prior months' balance into the viewed month.
export function groupEntriesByDay(
  entries: PlannerEntry[],
  openingBalance = 0,
): PlannerDayGroup[] {
  const ascending = entries
    .slice()
    .sort((a, b) => (a.date === b.date ? 0 : a.date < b.date ? -1 : 1));

  const byDate = new Map<string, PlannerDayRow[]>();
  let running = openingBalance;
  for (const entry of ascending) {
    running += entry.amount;
    const list = byDate.get(entry.date) ?? [];
    list.push({ entry, running });
    byDate.set(entry.date, list);
  }

  const groups: PlannerDayGroup[] = [];
  for (const [date, rows] of byDate) {
    const dayTotal = rows.reduce((sum, r) => sum + r.entry.amount, 0);
    groups.push({ date, rows, dayTotal });
  }
  groups.sort((a, b) => (a.date < b.date ? 1 : -1));
  return groups;
}

// Sum every entry dated strictly before the first day of the given month
// key. Used to seed the Planner's running tally so a fresh month doesn't
// snap back to $0 when the user has unspent income from prior months.
export function carryForwardBalance(
  entries: PlannerEntry[],
  monthKey: string,
): number {
  const cutoff = `${monthKey}-01`;
  let sum = 0;
  for (const e of entries) {
    if (e.date < cutoff) sum += e.amount;
  }
  return sum;
}
