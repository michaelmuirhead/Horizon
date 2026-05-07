import { describe, expect, it } from "vitest";
import {
  AGE_OF_MONEY_MIN_OUTFLOWS,
  ageOfMoneyByTransaction,
  ageOfMoneyDays,
  categorySpendingTrends,
  currentNetWorth,
  incomeBreakdownByPayee,
  incomeVsSpending,
  netWorthHistory,
  rangeTotals,
  spendingBreakdownForMonth,
  topSpendingPayees,
} from "./reflect";
import type { Account } from "./accounts";
import type { Transaction } from "./transactions";
import type { BudgetCategoryGroup } from "./budget";

const groups: BudgetCategoryGroup[] = [
  {
    id: "g",
    name: "Frequent",
    categories: [
      { id: "groc", name: "Groceries" },
      { id: "eat", name: "Eating Out" },
    ],
  },
];

function tx(p: Partial<Transaction>): Transaction {
  return {
    id: p.id ?? Math.random().toString(36).slice(2, 8),
    date: p.date ?? "2026-05-04",
    payee: p.payee ?? "Test",
    category: p.category ?? "Groceries",
    amount: p.amount ?? 0,
    account: p.account ?? "USAA",
    cleared: p.cleared ?? true,
    isReadyToAssign: p.isReadyToAssign,
    splits: p.splits,
    transferId: p.transferId,
  };
}

describe("spendingBreakdownForMonth", () => {
  it("attributes split sub-amounts and skips inflows / transfers", () => {
    const txs: Transaction[] = [
      tx({ date: "2026-05-04", category: "Groceries", amount: -25 }),
      tx({
        date: "2026-05-05",
        category: "Split",
        amount: -75,
        splits: [
          { category: "Groceries", amount: -50 },
          { category: "Eating Out", amount: -25 },
        ],
      }),
      tx({
        date: "2026-05-06",
        category: "Income: Ready to Assign",
        amount: 1000,
        isReadyToAssign: true,
      }),
      tx({
        date: "2026-05-07",
        category: "Transfer",
        amount: -100,
        transferId: "t1",
      }),
    ];
    const result = spendingBreakdownForMonth(txs, groups, 2026, 4);
    expect(result.total).toBe(100);
    const grocery = result.categories.find((c) => c.name === "Groceries");
    expect(grocery?.spent).toBe(75);
    const eatingOut = result.categories.find((c) => c.name === "Eating Out");
    expect(eatingOut?.spent).toBe(25);
  });
});

describe("incomeVsSpending", () => {
  it("only counts income when ready-to-assign is set", () => {
    const txs: Transaction[] = [
      tx({
        date: "2026-05-01",
        amount: 1000,
        isReadyToAssign: true,
      }),
      tx({
        date: "2026-05-02",
        category: "Refund",
        amount: 30, // positive but not RTA — no income
      }),
      tx({ date: "2026-05-04", category: "Groceries", amount: -75 }),
    ];
    const points = incomeVsSpending(txs, 2026, 4, 1);
    expect(points).toHaveLength(1);
    expect(points[0].income).toBe(1000);
    expect(points[0].spending).toBe(75);
  });
});

describe("currentNetWorth + history", () => {
  const accounts: Account[] = [
    { id: "checking", name: "Checking", type: "checking", balance: 1000 },
    {
      id: "card",
      name: "Card",
      type: "credit-card",
      balance: 0,
    },
  ];

  it("treats credit-card outflows as debt", () => {
    const txs: Transaction[] = [
      tx({ date: "2026-05-01", account: "Card", category: "Groceries", amount: -250 }),
    ];
    const nw = currentNetWorth(accounts, txs);
    expect(nw.assets).toBe(1000);
    expect(nw.debts).toBe(250);
  });

  it("excludes closed accounts from current net worth and history", () => {
    const withClosed: Account[] = [
      ...accounts,
      {
        id: "old",
        name: "Old Card",
        type: "credit-card",
        balance: -500,
        closed: true,
      },
    ];
    const nw = currentNetWorth(withClosed, []);
    expect(nw.debts).toBe(0); // Old Card is closed and ignored
    const hist = netWorthHistory(withClosed, [], 2026, 5, 2);
    for (const p of hist) expect(p.debts).toBe(0);
  });

  it("netWorthHistory back-calculates by reversing newer transactions", () => {
    const txs: Transaction[] = [
      tx({
        date: "2026-05-01",
        account: "Checking",
        amount: 200,
        isReadyToAssign: true,
      }),
    ];
    const points = netWorthHistory(accounts, txs, 2026, 5, 3);
    // April (before income) should be lower than May (after).
    const april = points.find((p) => p.month === "Apr");
    const may = points.find((p) => p.month === "May");
    expect(april?.assets ?? 0).toBeLessThan(may?.assets ?? 0);
  });
});

describe("ageOfMoneyDays / ageOfMoneyByTransaction", () => {
  it("returns null below the minimum outflow count", () => {
    const txs: Transaction[] = [
      tx({ date: "2026-05-01", amount: 1000, isReadyToAssign: true }),
      tx({ date: "2026-05-02", category: "Groceries", amount: -50 }),
    ];
    expect(ageOfMoneyDays(txs)).toBeNull();
  });

  it("computes a reasonable average once the minimum is met", () => {
    const txs: Transaction[] = [
      tx({ date: "2026-01-01", amount: 5000, isReadyToAssign: true }),
    ];
    for (let i = 0; i < AGE_OF_MONEY_MIN_OUTFLOWS; i++) {
      txs.push(
        tx({
          date: `2026-04-${String(i + 1).padStart(2, "0")}`,
          category: "Groceries",
          amount: -100,
        }),
      );
    }
    const days = ageOfMoneyDays(txs);
    expect(days).not.toBeNull();
    expect(days!).toBeGreaterThan(80); // ~ early April vs Jan 1
    expect(days!).toBeLessThan(140);

    const detail = ageOfMoneyByTransaction(txs);
    expect(detail.length).toBe(AGE_OF_MONEY_MIN_OUTFLOWS);
    for (const row of detail) {
      expect(row.averageAgeDays).toBeGreaterThan(80);
    }
  });
});

describe("categorySpendingTrends", () => {
  it("orders categories by total and per-month bins line up", () => {
    const txs: Transaction[] = [
      tx({ date: "2026-04-04", category: "Groceries", amount: -40 }),
      tx({ date: "2026-05-04", category: "Groceries", amount: -60 }),
      tx({ date: "2026-05-04", category: "Eating Out", amount: -20 }),
    ];
    const result = categorySpendingTrends(txs, groups, 2026, 4, 3);
    expect(result.months).toHaveLength(3);
    expect(result.trends[0].name).toBe("Groceries");
    expect(result.trends[0].total).toBe(100);
    // Last bin is the end month (May): groceries had $60.
    expect(result.trends[0].byMonth[2]).toBe(60);
  });
});

describe("rangeTotals", () => {
  it("returns net change and savings rate over the window", () => {
    const txs: Transaction[] = [
      tx({ date: "2026-05-01", amount: 1000, isReadyToAssign: true }),
      tx({ date: "2026-05-02", category: "Groceries", amount: -250 }),
      tx({ date: "2026-04-15", category: "Eating Out", amount: -100 }),
    ];
    const totals = rangeTotals(txs, 2026, 4, 2);
    expect(totals.income).toBe(1000);
    expect(totals.spending).toBe(350);
    expect(totals.net).toBe(650);
    expect(totals.savingsRate).toBeCloseTo(0.65, 5);
  });

  it("returns 0 savings rate when no income", () => {
    const txs: Transaction[] = [
      tx({ date: "2026-05-02", category: "Groceries", amount: -50 }),
    ];
    expect(rangeTotals(txs, 2026, 4, 1).savingsRate).toBe(0);
  });
});

describe("topSpendingPayees", () => {
  it("ranks outflow payees by total spend in the window", () => {
    const txs: Transaction[] = [
      tx({ date: "2026-05-04", payee: "Kroger", amount: -75 }),
      tx({ date: "2026-05-12", payee: "Kroger", amount: -25 }),
      tx({ date: "2026-05-04", payee: "Costco", amount: -200 }),
      tx({ date: "2026-05-15", payee: "Refund", amount: 30 }), // skipped (positive)
    ];
    const result = topSpendingPayees(txs, 2026, 4, 1);
    expect(result.entries).toHaveLength(2);
    expect(result.entries[0].payee).toBe("Costco");
    expect(result.entries[0].total).toBe(200);
    expect(result.entries[1].payee).toBe("Kroger");
    expect(result.entries[1].total).toBe(100);
  });
});

describe("incomeBreakdownByPayee", () => {
  it("groups RTA inflows by payee and ignores non-RTA positives", () => {
    const txs: Transaction[] = [
      tx({ date: "2026-05-01", payee: "Job", amount: 2000, isReadyToAssign: true }),
      tx({ date: "2026-05-15", payee: "Job", amount: 2000, isReadyToAssign: true }),
      tx({
        date: "2026-05-20",
        payee: "Bonus",
        amount: 500,
        isReadyToAssign: true,
      }),
      tx({ date: "2026-05-22", payee: "Refund", amount: 30 }), // not RTA
    ];
    const result = incomeBreakdownByPayee(txs, 2026, 4, 1);
    expect(result.entries).toHaveLength(2);
    expect(result.entries[0].payee).toBe("Job");
    expect(result.entries[0].total).toBe(4000);
    expect(result.entries[1].payee).toBe("Bonus");
  });
});
