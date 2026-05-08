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
  rows: PlannerDayRow[]; // newest first within the day
  dayTotal: number; // signed net for the day
};

// Build day-grouped rows for a month-scoped slice of entries. Groups come
// back newest-day first so they can be rendered top-down; rows within each
// day are also newest-first. Running balance is computed in chronological
// order and carries across day boundaries — matching Fudget's ledger feel.
export function groupEntriesByDay(entries: PlannerEntry[]): PlannerDayGroup[] {
  const ascending = entries.slice().sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? -1 : 1;
    return a.id < b.id ? -1 : 1;
  });

  const byDate = new Map<string, PlannerDayRow[]>();
  let running = 0;
  for (const entry of ascending) {
    running += entry.amount;
    const list = byDate.get(entry.date) ?? [];
    list.push({ entry, running });
    byDate.set(entry.date, list);
  }

  const groups: PlannerDayGroup[] = [];
  for (const [date, rows] of byDate) {
    const dayTotal = rows.reduce((sum, r) => sum + r.entry.amount, 0);
    groups.push({ date, rows: rows.slice().reverse(), dayTotal });
  }
  groups.sort((a, b) => (a.date < b.date ? 1 : -1));
  return groups;
}
