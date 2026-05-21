// Planner data model — Folders → Budgets → Entries.
//
// Each user can group budgets into folders ("April 2026", "Trip to Italy",
// "Side hustle"). A budget is a list of planned income/expense entries
// with a running balance. Entries belong to exactly one budget.

export type PlannerFolder = {
  id: string;
  name: string;
  // Lower numbers sort first. Optional so older payloads still validate;
  // selectors fall back to insertion order when missing.
  order?: number;
};

export type PlannerBudget = {
  id: string;
  folderId: string;
  name: string;
  order?: number;
};

export type PlannerEntry = {
  id: string;
  // Empty string means "unassigned" — only valid mid-migration. Every
  // user-visible entry should have a real budget id.
  budgetId: string;
  label: string;
  // Signed: positive = income, negative = expense.
  amount: number;
  // ISO YYYY-MM-DD. Optional — entries without a planned date render
  // a "Date" placeholder in the ledger and don't surface on the
  // calendar. Stored as undefined when unset; legacy "" values are
  // tolerated by callers via `date || undefined`.
  date?: string;
  // Whether this planned movement has cleared. Lets the budget UI show
  // "of which $X has actually posted." Optional; treat undefined as false.
  paid?: boolean;
  // Manual ordering inside a budget. Lower numbers render first. The
  // store keeps these dense via reorderPlannerEntry; ascending sort
  // breaks ties on insertion order.
  order?: number;
};

// Default IDs used by the v1→v2 migration so any rehydrated old client
// converges on the same single folder/budget without client-side coin
// flips. They're prefixed so they don't collide with makeId() output
// (which is a 12-char alphanumeric).
export const DEFAULT_FOLDER_ID = "default-folder";
export const DEFAULT_BUDGET_ID = "default-budget";

export const samplePlannerFolders: PlannerFolder[] = [
  { id: DEFAULT_FOLDER_ID, name: "My Plans", order: 0 },
];

export const samplePlannerBudgets: PlannerBudget[] = [
  {
    id: DEFAULT_BUDGET_ID,
    folderId: DEFAULT_FOLDER_ID,
    name: "Untitled",
    order: 0,
  },
];

export const samplePlannerEntries: PlannerEntry[] = [];

// Reusable Fudget templates — one row per recurring expense the user
// expects to drop into multiple budgets (rent, internet, electric,
// streaming subscriptions, etc.). App-wide, NOT scoped to a folder
// or budget: the same Rent template can populate every monthly budget.
// The picker on the budget detail page bulk-adds checked templates as
// fresh PlannerEntry rows on the current budget at today's date.
export type FudgetRecurring = {
  id: string;
  // Display label that becomes the new entry's label.
  label: string;
  // Signed amount — negative for expense, positive for income. The
  // template carries the sign so an "Income: Paycheck" template can
  // sit alongside expense templates.
  amount: number;
};

export const sampleFudgetRecurring: FudgetRecurring[] = [];

// ─── Pure helpers ───────────────────────────────────────────────────────

// Sort entries chronologically by date. The manual `order` field is a
// tiebreaker between same-date rows — drag-reorder still rearranges
// inside a date group, but it can no longer push an entry ahead of a
// row dated earlier than itself. Undated entries sort to the very end.
function sortEntriesForBudget(entries: PlannerEntry[]): PlannerEntry[] {
  return entries.slice().sort((a, b) => {
    const ad = a.date ?? "9999-99-99";
    const bd = b.date ?? "9999-99-99";
    if (ad !== bd) return ad < bd ? -1 : 1;
    const ao = a.order ?? Number.MAX_SAFE_INTEGER;
    const bo = b.order ?? Number.MAX_SAFE_INTEGER;
    if (ao !== bo) return ao - bo;
    return a.id < b.id ? -1 : 1;
  });
}

// Returns each entry alongside the running balance of the budget AFTER
// that entry posted, in display order.
export function entriesWithRunningBalance(
  entries: PlannerEntry[],
): { entry: PlannerEntry; running: number }[] {
  const sorted = sortEntriesForBudget(entries);
  let running = 0;
  return sorted.map((entry) => {
    running += entry.amount;
    return { entry, running };
  });
}

export type EntrySummary = {
  income: number;
  expense: number; // positive magnitude (UI shows "−$X")
  paid: number; // positive magnitude of cleared expenses
  balance: number;
};

export function summarizeEntries(entries: PlannerEntry[]): EntrySummary {
  let income = 0;
  let expense = 0;
  let paid = 0;
  for (const e of entries) {
    if (e.amount >= 0) {
      income += e.amount;
    } else {
      expense += -e.amount;
      if (e.paid) paid += -e.amount;
    }
  }
  return { income, expense, paid, balance: income - expense };
}

// Net balance for a single budget — sum of signed amounts.
export function budgetBalance(entries: PlannerEntry[]): number {
  return entries.reduce((sum, e) => sum + e.amount, 0);
}

// Sum across every budget that lives in `folderId`.
export function folderBalance(
  folderId: string,
  budgets: PlannerBudget[],
  entries: PlannerEntry[],
): number {
  const ids = new Set(
    budgets.filter((b) => b.folderId === folderId).map((b) => b.id),
  );
  let sum = 0;
  for (const e of entries) if (ids.has(e.budgetId)) sum += e.amount;
  return sum;
}

// ─── Date formatter (kept for legacy callers) ──────────────────────────

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

export function formatPlannerDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return dateFormatter.format(new Date(y, m - 1, d));
}

// Legacy helper still used by older callers that haven't been migrated
// to entriesWithRunningBalance + summarizeEntries.
export function plannerRunningTotal(entries: PlannerEntry[]): number {
  return entries.reduce((sum, e) => sum + e.amount, 0);
}
