import { describe, expect, it } from "vitest";
import { detectRecurring, isAlreadyScheduled } from "./recurring";
import type { Transaction } from "./transactions";
import type { ScheduledTransaction } from "./scheduled";

const tx = (overrides: Partial<Transaction>): Transaction => ({
  id: overrides.id ?? Math.random().toString(36).slice(2),
  date: overrides.date ?? "2026-01-01",
  payee: overrides.payee ?? "X",
  category: overrides.category ?? "Misc",
  amount: overrides.amount ?? -10,
  account: overrides.account ?? "Checking",
  cleared: overrides.cleared ?? true,
  ...overrides,
});

describe("detectRecurring", () => {
  it("flags a monthly outflow", () => {
    const out = detectRecurring([
      tx({ payee: "Netflix", amount: -15.99, date: "2026-01-15" }),
      tx({ payee: "Netflix", amount: -15.99, date: "2026-02-15" }),
      tx({ payee: "Netflix", amount: -15.99, date: "2026-03-15" }),
      tx({ payee: "Netflix", amount: -15.99, date: "2026-04-15" }),
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].cadence).toBe("monthly");
    expect(out[0].direction).toBe("expense");
    expect(out[0].averageAmount).toBe(15.99);
  });

  it("flags a biweekly income", () => {
    const out = detectRecurring([
      tx({ payee: "Acme Payroll", amount: 1800, date: "2026-01-02" }),
      tx({ payee: "Acme Payroll", amount: 1800, date: "2026-01-16" }),
      tx({ payee: "Acme Payroll", amount: 1800, date: "2026-01-30" }),
      tx({ payee: "Acme Payroll", amount: 1800, date: "2026-02-13" }),
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].cadence).toBe("biweekly");
    expect(out[0].direction).toBe("income");
  });

  it("ignores groups under the minimum hit threshold", () => {
    const out = detectRecurring([
      tx({ payee: "Once", amount: -10, date: "2026-01-01" }),
      tx({ payee: "Once", amount: -10, date: "2026-02-01" }),
    ]);
    expect(out).toEqual([]);
  });

  it("ignores groups whose amounts drift too widely", () => {
    const out = detectRecurring([
      tx({ payee: "Power Co", amount: -50, date: "2026-01-15" }),
      tx({ payee: "Power Co", amount: -180, date: "2026-02-15" }),
      tx({ payee: "Power Co", amount: -45, date: "2026-03-15" }),
      tx({ payee: "Power Co", amount: -210, date: "2026-04-15" }),
    ]);
    expect(out).toEqual([]);
  });

  it("ignores transfers and split transactions", () => {
    const out = detectRecurring([
      tx({ payee: "X", amount: -10, date: "2026-01-15", transferId: "t1" }),
      tx({ payee: "X", amount: -10, date: "2026-02-15", transferId: "t2" }),
      tx({ payee: "X", amount: -10, date: "2026-03-15", transferId: "t3" }),
      tx({
        payee: "Y",
        amount: -100,
        date: "2026-01-15",
        splits: [{ category: "a", amount: -50 }],
      }),
    ]);
    expect(out).toEqual([]);
  });
});

describe("isAlreadyScheduled", () => {
  it("matches when payee + cadence align (case-insensitive)", () => {
    const schedules: ScheduledTransaction[] = [
      {
        id: "s1",
        cadence: "monthly",
        nextDate: "2026-05-15",
        payee: "netflix",
        category: "Streaming",
        amount: -15.99,
        account: "Checking",
      },
    ];
    expect(
      isAlreadyScheduled(
        {
          direction: "expense",
          payee: "Netflix",
          category: "Streaming",
          account: "Checking",
          averageAmount: 15.99,
          hits: 4,
          lastSeen: "2026-04-15",
          cadence: "monthly",
          confidence: 0.95,
        },
        schedules,
      ),
    ).toBe(true);
  });

  it("does not match different cadences", () => {
    const schedules: ScheduledTransaction[] = [
      {
        id: "s1",
        cadence: "weekly",
        nextDate: "2026-05-15",
        payee: "Netflix",
        category: "Streaming",
        amount: -15.99,
        account: "Checking",
      },
    ];
    expect(
      isAlreadyScheduled(
        {
          direction: "expense",
          payee: "Netflix",
          category: "Streaming",
          account: "Checking",
          averageAmount: 15.99,
          hits: 4,
          lastSeen: "2026-04-15",
          cadence: "monthly",
          confidence: 0.95,
        },
        schedules,
      ),
    ).toBe(false);
  });
});
