import { describe, expect, it } from "vitest";
import {
  type Assignments,
  type BudgetCategory,
  type BudgetCategoryGroup,
  type CategoryTarget,
  categoryAvailable,
  categoryAvailableAtStart,
  categoryUnderfundedForMonth,
  ccPaymentRouting,
  monthKeyOf,
  monthlyNeedForCategory,
  readyToAssignAmount,
  setAssigned,
  shiftMonthKey,
  totalAssignedAllMonths,
  totalAssignedInMonth,
  totalOverspend,
  totalSpentInMonth,
} from "./budget";
import type { Transaction } from "./transactions";

const groceries: BudgetCategory = { id: "g", name: "Groceries" };
const eatingOut: BudgetCategory = { id: "e", name: "Eating Out" };
const groups: BudgetCategoryGroup[] = [
  { id: "freq", name: "Frequent", categories: [groceries, eatingOut] },
];

function tx(partial: Partial<Transaction>): Transaction {
  return {
    id: partial.id ?? Math.random().toString(36).slice(2, 8),
    date: partial.date ?? "2026-05-04",
    payee: partial.payee ?? "Test",
    category: partial.category ?? "Groceries",
    amount: partial.amount ?? 0,
    account: partial.account ?? "USAA",
    cleared: partial.cleared ?? true,
    isReadyToAssign: partial.isReadyToAssign,
    splits: partial.splits,
    transferId: partial.transferId,
  };
}

describe("monthKeyOf / shiftMonthKey", () => {
  it("zero-pads months", () => {
    expect(monthKeyOf(2026, 0)).toBe("2026-01");
    expect(monthKeyOf(2026, 11)).toBe("2026-12");
  });
  it("walks across year boundaries", () => {
    expect(shiftMonthKey("2026-01", -1)).toBe("2025-12");
    expect(shiftMonthKey("2026-12", 1)).toBe("2027-01");
  });
});

describe("setAssigned", () => {
  it("creates and overwrites", () => {
    let a: Assignments = {};
    a = setAssigned(a, "2026-05", "g", 100);
    expect(a["2026-05"].g).toBe(100);
    a = setAssigned(a, "2026-05", "g", 50);
    expect(a["2026-05"].g).toBe(50);
  });
  it("removes the entry on zero, and the month bucket when empty", () => {
    let a: Assignments = setAssigned({}, "2026-05", "g", 100);
    a = setAssigned(a, "2026-05", "g", 0);
    expect(a["2026-05"]).toBeUndefined();
  });
});

describe("totalAssigned helpers", () => {
  it("sums per-month and across-months", () => {
    let a: Assignments = {};
    a = setAssigned(a, "2026-05", "g", 100);
    a = setAssigned(a, "2026-05", "e", 50);
    a = setAssigned(a, "2026-06", "g", 25);
    expect(totalAssignedInMonth(a, "2026-05")).toBe(150);
    expect(totalAssignedInMonth(a, "2026-06")).toBe(25);
    expect(totalAssignedAllMonths(a)).toBe(175);
  });
});

describe("categoryAvailable + rollover", () => {
  it("carries unspent positives into the next month", () => {
    let a: Assignments = setAssigned({}, "2026-05", "g", 100);
    a = setAssigned(a, "2026-06", "g", 50);
    const txs: Transaction[] = [
      tx({ date: "2026-05-04", category: "Groceries", amount: -30 }),
    ];
    expect(categoryAvailable(groceries, a, txs, "2026-05")).toBe(70);
    expect(categoryAvailable(groceries, a, txs, "2026-06")).toBe(120);
  });

  it("clamps negative end-of-month balances at zero so overspend doesn't bleed", () => {
    let a: Assignments = setAssigned({}, "2026-05", "g", 50);
    a = setAssigned(a, "2026-06", "g", 20);
    const txs: Transaction[] = [
      tx({ date: "2026-05-04", category: "Groceries", amount: -80 }),
    ];
    // May shows the in-month negative.
    expect(categoryAvailable(groceries, a, txs, "2026-05")).toBe(-30);
    // June carries forward 0, plus its $20 assignment.
    expect(categoryAvailable(groceries, a, txs, "2026-06")).toBe(20);
  });

  it("availableAtStart reflects clamped carryover", () => {
    let a: Assignments = setAssigned({}, "2026-05", "g", 50);
    const txs: Transaction[] = [
      tx({ date: "2026-05-04", category: "Groceries", amount: -80 }),
    ];
    expect(categoryAvailableAtStart(groceries, a, txs, "2026-06")).toBe(0);
  });

  it("ignores transfers and ready-to-assign inflows", () => {
    const a: Assignments = setAssigned({}, "2026-05", "g", 100);
    const txs: Transaction[] = [
      tx({
        date: "2026-05-04",
        category: "Income: Ready to Assign",
        amount: 500,
        isReadyToAssign: true,
      }),
      tx({
        date: "2026-05-04",
        category: "Transfer",
        amount: -200,
        transferId: "xfer1",
      }),
      tx({ date: "2026-05-04", category: "Groceries", amount: -10 }),
    ];
    expect(categoryAvailable(groceries, a, txs, "2026-05")).toBe(90);
  });

  it("attributes split sub-amounts to each category", () => {
    let a: Assignments = setAssigned({}, "2026-05", "g", 100);
    a = setAssigned(a, "2026-05", "e", 50);
    const txs: Transaction[] = [
      tx({
        date: "2026-05-04",
        category: "Split",
        amount: -75,
        splits: [
          { category: "Groceries", amount: -50 },
          { category: "Eating Out", amount: -25 },
        ],
      }),
    ];
    expect(categoryAvailable(groceries, a, txs, "2026-05")).toBe(50);
    expect(categoryAvailable(eatingOut, a, txs, "2026-05")).toBe(25);
  });
});

describe("readyToAssignAmount + overspend", () => {
  it("subtracts assignments and absorbed overspend from income", () => {
    let a: Assignments = setAssigned({}, "2026-05", "g", 50);
    a = setAssigned(a, "2026-06", "g", 100);
    const txs: Transaction[] = [
      tx({ date: "2026-05-01", amount: 1000, isReadyToAssign: true }),
      // May overspends Groceries by $30, which becomes overspend absorbed
      // into RTA.
      tx({ date: "2026-05-04", category: "Groceries", amount: -80 }),
    ];
    expect(totalOverspend(groups, a, txs)).toBe(30);
    expect(readyToAssignAmount(txs, a, groups)).toBe(1000 - 150 - 30);
  });
});

describe("monthlyNeedForCategory", () => {
  it("set-aside scales weekly and yearly to monthly equivalents", () => {
    const weekly: CategoryTarget = {
      kind: "set-aside",
      amount: 50,
      cadence: "weekly",
    };
    const yearly: CategoryTarget = {
      kind: "set-aside",
      amount: 600,
      cadence: "yearly",
    };
    expect(monthlyNeedForCategory(groceries, weekly, {}, [], "2026-05")).toBeCloseTo(
      50 * (52 / 12),
      5,
    );
    expect(monthlyNeedForCategory(groceries, yearly, {}, [], "2026-05")).toBeCloseTo(
      50,
      5,
    );
  });

  it("refill returns the gap from start-of-month", () => {
    const a: Assignments = setAssigned({}, "2026-04", "g", 200);
    // No outflows in May, carryover = 200, refill target 250 -> need = 50.
    const target: CategoryTarget = { kind: "refill", amount: 250 };
    expect(monthlyNeedForCategory(groceries, target, a, [], "2026-05")).toBe(50);
  });

  it("by-date spreads remaining over months left", () => {
    const target: CategoryTarget = {
      kind: "by-date",
      amount: 1000,
      dueDate: "2026-08-01",
    };
    // From 2026-05 to 2026-08 there are 3 months remaining.
    expect(monthlyNeedForCategory(groceries, target, {}, [], "2026-05")).toBeCloseTo(
      1000 / 3,
      5,
    );
  });

  it("paused targets stop counting toward underfunded", () => {
    const target: CategoryTarget = {
      kind: "set-aside",
      amount: 100,
      cadence: "monthly",
      paused: true,
    };
    expect(
      categoryUnderfundedForMonth(groceries, target, {}, [], "2026-05"),
    ).toBe(0);
  });

  // Surface that the by-date and refill targets feeding the Budget tab
  // self-correct: missed months grow the per-month need, over-funded
  // months shrink it.
  it("by-date grows the monthly need when prior months are missed", () => {
    const target: CategoryTarget = {
      kind: "by-date",
      amount: 1200,
      dueDate: "2026-12-01",
    };
    // Starting point in May — 7 months between May and December.
    const startNeed = monthlyNeedForCategory(
      groceries,
      target,
      {},
      [],
      "2026-05",
    );
    expect(startNeed).toBeCloseTo(1200 / 7, 5);
    // Skip May (assign nothing) and re-evaluate June. End-of-May balance
    // is still 0, so 1200 spread over the remaining 6 months → $200/mo.
    const juneNeed = monthlyNeedForCategory(
      groceries,
      target,
      {},
      [],
      "2026-06",
    );
    expect(juneNeed).toBeCloseTo(1200 / 6, 5);
    expect(juneNeed).toBeGreaterThan(startNeed);
  });

  it("by-date shrinks the monthly need when the user gets ahead", () => {
    const target: CategoryTarget = {
      kind: "by-date",
      amount: 1200,
      dueDate: "2026-12-01",
    };
    // Assign $400 in May (well above the May "need"). End-of-May balance
    // carries 400 forward → June only has to spread $800 over 6 months.
    const ahead = setAssigned({}, "2026-05", "g", 400);
    const juneNeed = monthlyNeedForCategory(
      groceries,
      target,
      ahead,
      [],
      "2026-06",
    );
    expect(juneNeed).toBeCloseTo(800 / 6, 5);
    expect(juneNeed).toBeLessThan(1200 / 6);
  });

  it("by-date drops to zero once the goal amount is already saved", () => {
    const target: CategoryTarget = {
      kind: "by-date",
      amount: 500,
      dueDate: "2026-12-01",
    };
    const fullyFunded = setAssigned({}, "2026-05", "g", 500);
    const juneNeed = monthlyNeedForCategory(
      groceries,
      target,
      fullyFunded,
      [],
      "2026-06",
    );
    expect(juneNeed).toBe(0);
  });

  it("refill catches up when the previous month was missed", () => {
    const target: CategoryTarget = { kind: "refill", amount: 250 };
    // No assignment in April → start-of-May available is 0 → need = 250.
    expect(monthlyNeedForCategory(groceries, target, {}, [], "2026-05")).toBe(
      250,
    );
    // Assigned $100 in April → start-of-May = $100 → need = 150.
    const partial = setAssigned({}, "2026-04", "g", 100);
    expect(
      monthlyNeedForCategory(groceries, target, partial, [], "2026-05"),
    ).toBe(150);
  });
});

describe("ccPaymentRouting", () => {
  const ccGroups: BudgetCategoryGroup[] = [
    {
      id: "freq",
      name: "Frequent",
      categories: [groceries],
    },
    {
      id: "ccpay",
      name: "Credit Card Payments",
      categories: [{ id: "chase-pay", name: "Chase Visa" }],
    },
  ];
  const ccAccounts = [
    {
      name: "Chase Visa",
      type: "credit-card",
      ccPaymentCategoryId: "chase-pay",
    },
  ];

  it("credits the payment category when a CC outflow is recorded", () => {
    const ctx = ccPaymentRouting(ccAccounts, ccGroups);
    const ccPayment: BudgetCategory = { id: "chase-pay", name: "Chase Visa" };
    let a: Assignments = setAssigned({}, "2026-05", "g", 100);
    const txs: Transaction[] = [
      tx({
        date: "2026-05-04",
        account: "Chase Visa",
        category: "Groceries",
        amount: -40,
      }),
    ];
    // Groceries debited as usual.
    expect(categoryAvailable(groceries, a, txs, "2026-05", ctx)).toBe(60);
    // Payment category credited by the same magnitude.
    expect(categoryAvailable(ccPayment, a, txs, "2026-05", ctx)).toBe(40);
  });

  it("debits the payment category when a transfer lands on a CC", () => {
    const ctx = ccPaymentRouting(ccAccounts, ccGroups);
    const ccPayment: BudgetCategory = { id: "chase-pay", name: "Chase Visa" };
    let a: Assignments = setAssigned({}, "2026-05", "g", 100);
    a = setAssigned(a, "2026-05", "chase-pay", 200);
    const txs: Transaction[] = [
      // Charge: groceries on the card → +$40 to payment category.
      tx({
        date: "2026-05-04",
        account: "Chase Visa",
        category: "Groceries",
        amount: -40,
      }),
      // Bill payment from checking → debits the payment envelope by $50.
      tx({
        date: "2026-05-15",
        account: "USAA",
        category: "Transfer",
        amount: -50,
        transferId: "pay1",
      }),
      tx({
        date: "2026-05-15",
        account: "Chase Visa",
        category: "Transfer",
        amount: 50,
        transferId: "pay1",
      }),
    ];
    // Payment envelope: assigned 200, +40 from charge, -50 from bill payment.
    expect(categoryAvailable(ccPayment, a, txs, "2026-05", ctx)).toBe(190);
    // Groceries unaffected by the transfer.
    expect(categoryAvailable(groceries, a, txs, "2026-05", ctx)).toBe(60);
  });

  it("ignores the routing for non-CC accounts", () => {
    const ctx = ccPaymentRouting(ccAccounts, ccGroups);
    const ccPayment: BudgetCategory = { id: "chase-pay", name: "Chase Visa" };
    const a: Assignments = setAssigned({}, "2026-05", "g", 100);
    const txs: Transaction[] = [
      tx({
        date: "2026-05-04",
        account: "USAA",
        category: "Groceries",
        amount: -40,
      }),
    ];
    expect(categoryAvailable(groceries, a, txs, "2026-05", ctx)).toBe(60);
    // No CC routing for a checking-account outflow.
    expect(categoryAvailable(ccPayment, a, txs, "2026-05", ctx)).toBe(0);
  });
});

describe("totalSpentInMonth", () => {
  it("clamps to zero when refunds exceed outflows", () => {
    const txs: Transaction[] = [
      tx({ date: "2026-05-01", category: "Groceries", amount: -50 }),
      tx({ date: "2026-05-15", category: "Groceries", amount: 100 }),
    ];
    expect(totalSpentInMonth(txs, 2026, 4)).toBe(0);
  });
  it("ignores other months and ready-to-assign inflows", () => {
    const txs: Transaction[] = [
      tx({ date: "2026-04-30", category: "Groceries", amount: -20 }),
      tx({
        date: "2026-05-01",
        category: "Income: Ready to Assign",
        amount: 500,
        isReadyToAssign: true,
      }),
      tx({ date: "2026-05-15", category: "Groceries", amount: -75 }),
    ];
    expect(totalSpentInMonth(txs, 2026, 4)).toBe(75);
  });
});
