import { describe, expect, it } from "vitest";
import { baselineDailyDrift, projectCashFlow } from "./cashflow";
import type { Account } from "./accounts";
import type { Transaction } from "./transactions";
import type { ScheduledTransaction } from "./scheduled";

const accounts: Account[] = [
  { id: "checking", name: "Checking", type: "checking", balance: 1000 },
  { id: "savings", name: "Savings", type: "savings", balance: 500 },
  { id: "card", name: "Card", type: "credit-card", balance: -200 },
];

const transactions: Transaction[] = [];

describe("projectCashFlow", () => {
  it("starts at the sum of asset balances and walks scheduled hits", () => {
    const scheds: ScheduledTransaction[] = [
      {
        id: "rent",
        kind: "transaction",
        cadence: "monthly",
        nextDate: "2026-05-10",
        payee: "Landlord",
        category: "Rent/Mortgage",
        amount: -800,
        account: "Checking",
      },
      {
        id: "pay",
        kind: "transaction",
        cadence: "biweekly",
        nextDate: "2026-05-08",
        payee: "Employer",
        category: "Income: Ready to Assign",
        amount: 1200,
        account: "Checking",
      },
    ];
    const out = projectCashFlow(accounts, transactions, scheds, 30, "2026-05-05");
    expect(out.start).toBe(1500);
    // 1500 + 1200 (5/8) - 800 (5/10) + 1200 (5/22) = 3100 by day 30
    expect(out.series[out.series.length - 1].balance).toBe(3100);
    expect(out.end).toBe(3100);
  });

  it("flags the lowest projected dip", () => {
    const scheds: ScheduledTransaction[] = [
      {
        id: "big",
        kind: "transaction",
        cadence: "monthly",
        nextDate: "2026-05-08",
        payee: "Tax",
        category: "Bills",
        amount: -2000,
        account: "Checking",
      },
    ];
    const out = projectCashFlow(accounts, transactions, scheds, 30, "2026-05-05");
    expect(out.low.date).toBe("2026-05-08");
    expect(out.low.balance).toBe(-500);
  });

  it("layers in a baseline drift on each future day except day 0", () => {
    const out = projectCashFlow(accounts, transactions, [], 10, "2026-05-05", -5);
    expect(out.start).toBe(1500);
    // Day 0 = 1500, day 10 = 1500 + 10 * (-5) = 1450.
    expect(out.end).toBe(1450);
  });

  it("skips intra-asset transfers but counts asset→liability ones", () => {
    const scheds: ScheduledTransaction[] = [
      {
        id: "shuffle",
        kind: "transfer",
        cadence: "monthly",
        nextDate: "2026-05-10",
        fromAccount: "Checking",
        toAccount: "Savings",
        amount: 300,
      },
      {
        id: "pay-card",
        kind: "transfer",
        cadence: "monthly",
        nextDate: "2026-05-12",
        fromAccount: "Checking",
        toAccount: "Card",
        amount: 100,
      },
    ];
    const out = projectCashFlow(accounts, transactions, scheds, 30, "2026-05-05");
    // Intra-asset shuffle has no effect on liquid total. Card payment costs $100.
    expect(out.end).toBe(1400);
  });
});

describe("baselineDailyDrift", () => {
  const today = "2026-05-13";
  const driftAccounts: Account[] = [
    { id: "c", name: "Checking", type: "checking", balance: 0 },
  ];

  it("returns empty when no history matches", () => {
    const out = baselineDailyDrift(driftAccounts, [], [], today);
    expect(out).toEqual({
      drift: 0,
      daysOfHistory: 0,
      txCount: 0,
      hasEnoughData: false,
    });
  });

  it("divides by the actual span when history is shorter than the lookback", () => {
    // 10 transactions, 1/day for 10 days, net = -200. Span = 10 days, so
    // drift should be -20/day — NOT -200/90.
    const txs: Transaction[] = Array.from({ length: 10 }, (_, i) => {
      const day = String(13 - i).padStart(2, "0");
      return {
        id: `t${i}`,
        date: `2026-05-${day}`,
        payee: "Coffee",
        category: "Food",
        amount: -20,
        account: "Checking",
        cleared: true,
      };
    });
    const out = baselineDailyDrift(driftAccounts, txs, [], today);
    expect(out.daysOfHistory).toBe(10);
    expect(out.txCount).toBe(10);
    expect(out.drift).toBe(-20);
  });

  it("flags hasEnoughData=false when history is too thin", () => {
    // 5 days, 5 txs — below both floors (14 days / 8 txs).
    const txs: Transaction[] = Array.from({ length: 5 }, (_, i) => ({
      id: `t${i}`,
      date: `2026-05-${String(13 - i).padStart(2, "0")}`,
      payee: "Coffee",
      category: "Food",
      amount: -10,
      account: "Checking",
      cleared: true,
    }));
    const out = baselineDailyDrift(driftAccounts, txs, [], today);
    expect(out.hasEnoughData).toBe(false);
  });

  it("hasEnoughData=true when both day and tx floors are met", () => {
    // 21 days, 15 txs.
    const txs: Transaction[] = [];
    for (let i = 0; i < 15; i++) {
      const day = String(13 - Math.floor((i * 21) / 15)).padStart(2, "0");
      txs.push({
        id: `t${i}`,
        date: `2026-04-${day}`,
        payee: "Coffee",
        category: "Food",
        amount: -10,
        account: "Checking",
        cleared: true,
      });
    }
    // Plus one tx on day -21 so the span is solidly 21+ days.
    txs.push({
      id: "old",
      date: "2026-04-22",
      payee: "Coffee",
      category: "Food",
      amount: -10,
      account: "Checking",
      cleared: true,
    });
    const out = baselineDailyDrift(driftAccounts, txs, [], today);
    expect(out.txCount).toBeGreaterThanOrEqual(8);
    expect(out.daysOfHistory).toBeGreaterThanOrEqual(14);
    expect(out.hasEnoughData).toBe(true);
  });

  it("excludes transactions whose payee matches a scheduled non-transfer", () => {
    const txs: Transaction[] = Array.from({ length: 10 }, (_, i) => ({
      id: `t${i}`,
      date: `2026-05-${String(13 - i).padStart(2, "0")}`,
      payee: "Netflix",
      category: "Streaming",
      amount: -15.99,
      account: "Checking",
      cleared: true,
    }));
    const scheds: ScheduledTransaction[] = [
      {
        id: "s1",
        cadence: "monthly",
        nextDate: "2026-06-13",
        payee: "Netflix",
        category: "Streaming",
        amount: -15.99,
        account: "Checking",
      },
    ];
    const out = baselineDailyDrift(driftAccounts, txs, scheds, today);
    expect(out.txCount).toBe(0);
    expect(out.drift).toBe(0);
  });
});
