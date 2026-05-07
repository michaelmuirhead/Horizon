import { describe, expect, it } from "vitest";
import { snapshotAt } from "./timeMachine";
import type { Transaction } from "./transactions";
import type { Assignments } from "./budget";

const txs: Transaction[] = [
  {
    id: "1",
    date: "2026-04-15",
    payee: "Kroger",
    category: "Groceries",
    amount: -50,
    account: "USAA",
    cleared: true,
  },
  {
    id: "2",
    date: "2026-05-10",
    payee: "Kroger",
    category: "Groceries",
    amount: -75,
    account: "USAA",
    cleared: true,
  },
  {
    id: "3",
    date: "2026-05-25",
    payee: "Kroger",
    category: "Groceries",
    amount: -100,
    account: "USAA",
    cleared: true,
  },
];

const assignments: Assignments = {
  "2026-04": { groceries: 200 },
  "2026-05": { groceries: 300 },
  "2026-06": { groceries: 400 },
};

describe("snapshotAt", () => {
  it("includes only transactions on or before the as-of date", () => {
    const snap = snapshotAt("2026-05-15", txs, assignments);
    expect(snap.transactions.map((t) => t.id)).toEqual(["1", "2"]);
  });

  it("includes assignments from the as-of month and earlier, never future", () => {
    const snap = snapshotAt("2026-05-15", txs, assignments);
    expect(Object.keys(snap.assignments).sort()).toEqual(["2026-04", "2026-05"]);
  });

  it("returns the correct monthKey", () => {
    const snap = snapshotAt("2026-05-15", txs, assignments);
    expect(snap.asOfMonthKey).toBe("2026-05");
  });
});
