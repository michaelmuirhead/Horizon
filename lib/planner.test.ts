import { describe, expect, it } from "vitest";
import {
  carryForwardBalance,
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

  it("seeds the running balance from openingBalance", () => {
    const groups = groupEntriesByDay(entries, 500);
    // May 1 first row was 2000; with +500 carry it should be 2500.
    expect(groups[1].rows[0].running).toBe(2500);
    // Final row of the newest day shows the carried-through total.
    expect(groups[0].rows.at(-1)?.running).toBe(1600);
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

describe("carryForwardBalance", () => {
  const acrossMonths: PlannerEntry[] = [
    { id: "1", label: "April pay", amount: 3000, date: "2026-04-30" },
    { id: "2", label: "April rent", amount: -800, date: "2026-04-01" },
    { id: "3", label: "May coffee", amount: -5, date: "2026-05-02" },
    { id: "4", label: "June bonus", amount: 200, date: "2026-06-15" },
  ];

  it("sums every entry strictly before the first of the month", () => {
    expect(carryForwardBalance(acrossMonths, "2026-05")).toBe(2200);
  });

  it("returns 0 when no prior entries exist", () => {
    expect(carryForwardBalance(acrossMonths, "2026-04")).toBe(0);
  });

  it("includes both prior months when looking at June", () => {
    // Apr net 2200, May −5; carry into June is 2195.
    expect(carryForwardBalance(acrossMonths, "2026-06")).toBe(2195);
  });
});
