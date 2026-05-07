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

export function formatPlannerDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return dateFormatter.format(new Date(y, m - 1, d));
}
