import { describe, expect, it } from "vitest";
import {
  groupEntriesByDay,
  summarizeEntries,
  type PlannerEntry,
} from "./planner";

const entries: PlannerEntry[] = [
  { id: "a", label: "Paycheck", amount: 2000, date: "2026-05-01" },
  { id: "b", label: "Rent", amount: -800, date: "2026-05-01" },
  { id: "c", label: "Groceries", amount: -120, date: "2026-05-03" },
  { id: "d", label: "Coffee", amount: -5, date: "2026-05-03" },
  { id: "e", label: "Refund", amount: 25, date: "2026-05-03" },
];

describe("summarizeEntries", () => {
  it("splits income and expense, expense as a positive magnitude", () => {
    expect(summarizeEntries(entries)).toEqual({
      income: 2025,
      expense: 925,
      balance: 1100,
    });
  });

  it("handles an empty list as all zeros", () => {
    expect(summarizeEntries([])).toEqual({ income: 0, expense: 0, balance: 0 });
  });
});

describe("groupEntriesByDay", () => {
  it("groups by date, newest day first, with rows newest-first within day", () => {
    const groups = groupEntriesByDay(entries);
    expect(groups.map((g) => g.date)).toEqual(["2026-05-03", "2026-05-01"]);
    expect(groups[0].rows.map((r) => r.entry.id)).toEqual(["e", "d", "c"]);
    expect(groups[1].rows.map((r) => r.entry.id)).toEqual(["b", "a"]);
  });

  it("sums each day's net regardless of sign", () => {
    const groups = groupEntriesByDay(entries);
    expect(groups[0].dayTotal).toBe(-100);
    expect(groups[1].dayTotal).toBe(1200);
  });

  it("walks running balance chronologically across day boundaries", () => {
    const groups = groupEntriesByDay(entries);
    // Newest day, displayed newest-first: e (1100), d (1075), c (1080).
    expect(groups[0].rows.map((r) => r.running)).toEqual([1100, 1075, 1080]);
    // Oldest day: b (1200), a (2000) — newest of that day on top.
    expect(groups[1].rows.map((r) => r.running)).toEqual([1200, 2000]);
  });
});
