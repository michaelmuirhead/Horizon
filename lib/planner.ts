// Top-level grouping. A folder holds many budgets — e.g. "Muirhead
// Budget" containing "March", "Dentist", "PTO".
export type PlannerFolder = {
  id: string;
  name: string;
};

// A single ledger inside a folder. Each budget has its own running
// balance built from its own entries — entries do NOT carry across
// budgets, even within the same folder.
export type PlannerBudget = {
  id: string;
  folderId: string;
  name: string;
};

export type PlannerEntry = {
  id: string;
  budgetId: string;
  label: string;
  // Signed: positive = income, negative = expense.
  amount: number;
  // Optional ISO YYYY-MM-DD. Undated entries render with a "Date"
  // placeholder in the ledger and don't appear on the calendar.
  date?: string;
  // Paid entries are still counted toward the running balance and
  // totals; the flag just drives the strikethrough styling and a
  // separate "Paid" subtotal at the bottom of the budget.
  paid?: boolean;
};

export const samplePlannerFolders: PlannerFolder[] = [
  { id: "folder-muirhead", name: "Muirhead Budget" },
  { id: "folder-section6", name: "Section 6" },
  { id: "folder-rekindle", name: "ReKindle" },
];

export const samplePlannerBudgets: PlannerBudget[] = [];

export const samplePlannerEntries: PlannerEntry[] = [];

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

export function formatPlannerDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return dateFormatter.format(new Date(y, m - 1, d));
}

export type PlannerSummary = {
  // Sum of positive-amount entries (regardless of paid).
  income: number;
  // Sum of |negative-amount| entries (regardless of paid).
  expense: number;
  // Sum of |negative-amount| entries with paid=true. Shown separately
  // as an informational "already settled" line; it's a subset of
  // `expense` and doesn't change `balance`.
  paid: number;
  // income - expense — what the budget projects to net out at.
  balance: number;
};

export function summarizeEntries(entries: PlannerEntry[]): PlannerSummary {
  let income = 0;
  let expense = 0;
  let paid = 0;
  for (const e of entries) {
    if (e.amount > 0) income += e.amount;
    else expense += -e.amount;
    if (e.paid && e.amount < 0) paid += -e.amount;
  }
  return { income, expense, paid, balance: income - expense };
}

export type EntryWithBalance = {
  entry: PlannerEntry;
  // Cumulative budget balance after this entry posted. Walks through
  // the entries in array order, regardless of paid state.
  running: number;
};

// Walks a budget's entries in their stored order, building a running
// balance for the ledger view. The balance includes paid entries.
export function entriesWithRunningBalance(
  entries: PlannerEntry[],
): EntryWithBalance[] {
  let running = 0;
  return entries.map((entry) => {
    running += entry.amount;
    return { entry, running };
  });
}

// Net balance of a budget (signed). Used by the budget list rows and
// the folder-level total.
export function budgetBalance(entries: PlannerEntry[]): number {
  return entries.reduce((sum, e) => sum + e.amount, 0);
}

// Net balance for a folder = sum of every entry across every budget in
// that folder.
export function folderBalance(
  folderId: string,
  budgets: PlannerBudget[],
  entries: PlannerEntry[],
): number {
  const budgetIds = new Set(
    budgets.filter((b) => b.folderId === folderId).map((b) => b.id),
  );
  let sum = 0;
  for (const e of entries) {
    if (budgetIds.has(e.budgetId)) sum += e.amount;
  }
  return sum;
}
