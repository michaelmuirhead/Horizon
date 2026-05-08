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
  it("groups by date newest-day first, preserving input order within a day", () => {
    const groups = groupEntriesByDay(entries);
    expect(groups.map((g) => g.date)).toEqual(["2026-05-03", "2026-05-01"]);
    expect(groups[0].rows.map((r) => r.entry.id)).toEqual(["c", "d", "e"]);
    expect(groups[1].rows.map((r) => r.entry.id)).toEqual(["a", "b"]);
  });

  it("sums each day's net regardless of sign", () => {
    const groups = groupEntriesByDay(entries);
    expect(groups[0].dayTotal).toBe(-100);
    expect(groups[1].dayTotal).toBe(1200);
  });

  it("walks running balance in the supplied within-day order", () => {
    const groups = groupEntriesByDay(entries);
    // May 3 in input order: c (1080), d (1075), e (1100).
    expect(groups[0].rows.map((r) => r.running)).toEqual([1080, 1075, 1100]);
    // May 1 in input order: a (2000), b (1200).
    expect(groups[1].rows.map((r) => r.running)).toEqual([2000, 1200]);
  });

  it("reflects a swapped within-day order in the running balance", () => {
    // Swap c ↔ e to mimic a drag: e now leads May 3, then d, then c.
    const swapped: PlannerEntry[] = [
      entries[0],
      entries[1],
      entries[4],
      entries[3],
      entries[2],
    ];
    const groups = groupEntriesByDay(swapped);
    expect(groups[0].rows.map((r) => r.entry.id)).toEqual(["e", "d", "c"]);
    expect(groups[0].rows.map((r) => r.running)).toEqual([1225, 1220, 1100]);
  });
});
