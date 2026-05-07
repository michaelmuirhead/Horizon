import { describe, expect, it } from "vitest";
import { projectCashFlow } from "./cashflow";
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
