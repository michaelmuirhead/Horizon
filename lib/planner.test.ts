import { describe, expect, it } from "vitest";
import {
  budgetBalance,
  entriesWithRunningBalance,
  folderBalance,
  summarizeEntries,
  type PlannerBudget,
  type PlannerEntry,
} from "./planner";

const sample: PlannerEntry[] = [
  { id: "a", budgetId: "b1", label: "Paycheck", amount: 2000 },
  { id: "b", budgetId: "b1", label: "Rent", amount: -800, paid: true },
  { id: "c", budgetId: "b1", label: "Groceries", amount: -120 },
  { id: "d", budgetId: "b1", label: "Coffee", amount: -5, paid: true },
];

describe("summarizeEntries", () => {
  it("splits income, expense, paid, and balance", () => {
    expect(summarizeEntries(sample)).toEqual({
      income: 2000,
      expense: 925,
      paid: 805,
      balance: 1075,
    });
  });

  it("treats an empty list as all zeros", () => {
    expect(summarizeEntries([])).toEqual({
      income: 0,
      expense: 0,
      paid: 0,
      balance: 0,
    });
  });

  it("does not double-count paid income — paid only sums settled outflows", () => {
    const withPaidIncome: PlannerEntry[] = [
      { id: "x", budgetId: "b1", label: "Bonus", amount: 200, paid: true },
    ];
    expect(summarizeEntries(withPaidIncome).paid).toBe(0);
  });
});

describe("entriesWithRunningBalance", () => {
  it("walks the array order and emits a cumulative running tally", () => {
    const rows = entriesWithRunningBalance(sample);
    expect(rows.map((r) => r.running)).toEqual([2000, 1200, 1080, 1075]);
  });

  it("includes paid entries in the running tally", () => {
    const last = entriesWithRunningBalance(sample).at(-1);
    expect(last?.running).toBe(1075);
  });
});

describe("budgetBalance", () => {
  it("sums signed amounts in any order", () => {
    expect(budgetBalance(sample)).toBe(1075);
    expect(budgetBalance([])).toBe(0);
  });
});

describe("folderBalance", () => {
  const budgets: PlannerBudget[] = [
    { id: "b1", folderId: "f1", name: "March" },
    { id: "b2", folderId: "f1", name: "April" },
    { id: "b3", folderId: "f2", name: "Section 6 March" },
  ];
  const entries: PlannerEntry[] = [
    { id: "1", budgetId: "b1", label: "x", amount: 100 },
    { id: "2", budgetId: "b2", label: "y", amount: -25 },
    { id: "3", budgetId: "b3", label: "z", amount: 500 },
  ];

  it("sums every entry in every budget belonging to the folder", () => {
    expect(folderBalance("f1", budgets, entries)).toBe(75);
    expect(folderBalance("f2", budgets, entries)).toBe(500);
  });

  it("returns 0 for a folder with no budgets", () => {
    expect(folderBalance("missing", budgets, entries)).toBe(0);
  });
});
