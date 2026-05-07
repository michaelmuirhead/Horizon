// Snapshot helpers for the Budget time machine. Slices the existing
// state down to "everything that had happened by date X" so the existing
// budget math keeps working unchanged.
//
// Note on granularity: assignments live per-month, not per-day, so a
// pick of "May 15" includes every assignment posted to May (or earlier)
// because we have no way to know mid-month exactly when each assignment
// landed. Transactions are filtered by exact date.

import type { Transaction } from "./transactions";
import type { Assignments } from "./budget";

export type BudgetSnapshot = {
  asOf: string;
  asOfMonthKey: string;
  transactions: Transaction[];
  assignments: Assignments;
};

export function snapshotAt(
  asOf: string,
  transactions: Transaction[],
  assignments: Assignments,
): BudgetSnapshot {
  const asOfMonthKey = asOf.slice(0, 7);
  const slicedTxs = transactions.filter((t) => t.date <= asOf);
  const slicedAssignments: Assignments = {};
  for (const [monthKey, perCat] of Object.entries(assignments)) {
    if (monthKey > asOfMonthKey) continue;
    slicedAssignments[monthKey] = { ...perCat };
  }
  return {
    asOf,
    asOfMonthKey,
    transactions: slicedTxs,
    assignments: slicedAssignments,
  };
}
