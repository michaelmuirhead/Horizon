import { describe, expect, it } from "vitest";
import type { Account } from "./accounts";
import type { Transaction } from "./transactions";
import {
  debtApr,
  debtMinimumPayment,
  isDebtAccount,
  listDebts,
  summarizeDebts,
} from "./debts";

function card(overrides: Partial<Account> = {}): Account {
  return {
    id: "card-1",
    name: "Visa",
    type: "credit-card",
    balance: -1000,
    ...overrides,
  };
}

function loan(overrides: Partial<Account> = {}): Account {
  return {
    id: "loan-1",
    name: "Auto",
    type: "loan",
    balance: -10000,
    loanApr: 6,
    loanTermMonths: 60,
    loanOriginalPrincipal: 10000,
    ...overrides,
  };
}

describe("isDebtAccount", () => {
  it("recognises liability account types", () => {
    expect(isDebtAccount(card())).toBe(true);
    expect(isDebtAccount(loan())).toBe(true);
    expect(isDebtAccount({ ...card(), type: "checking" })).toBe(false);
  });
});

describe("debtApr", () => {
  it("prefers the explicit apr field over loanApr", () => {
    expect(debtApr(loan({ apr: 4.25, loanApr: 6 }))).toBe(4.25);
  });
  it("falls back to loanApr for loans", () => {
    expect(debtApr(loan({ apr: undefined, loanApr: 6 }))).toBe(6);
  });
  it("returns null when nothing is set", () => {
    expect(debtApr(card({ apr: undefined }))).toBeNull();
  });
});

describe("debtMinimumPayment", () => {
  it("uses the user-set minimum payment first", () => {
    const result = debtMinimumPayment(card({ minimumPayment: 50 }), 1000);
    expect(result.value).toBe(50);
    expect(result.estimated).toBe(false);
  });

  it("estimates from amortization for a loan with terms but no minimum", () => {
    const result = debtMinimumPayment(loan(), 10000);
    expect(result.value).not.toBeNull();
    expect(result.estimated).toBe(true);
    // 10k @ 6% / 60mo ≈ 193.33
    expect(result.value).toBeCloseTo(193.33, 1);
  });

  it("returns null when nothing can be derived", () => {
    const result = debtMinimumPayment(card({ minimumPayment: undefined }), 500);
    expect(result.value).toBeNull();
    expect(result.estimated).toBe(false);
  });
});

describe("listDebts", () => {
  it("includes only open liability accounts and orders by balance", () => {
    const accounts: Account[] = [
      card({ id: "a", name: "Small", balance: -500, apr: 18 }),
      loan({ id: "b", name: "Big", balance: -20000 }),
      { id: "c", name: "Checking", type: "checking", balance: 1000 },
      card({ id: "d", name: "Closed", balance: -300, closed: true }),
    ];
    const rows = listDebts(accounts, [] as Transaction[]);
    expect(rows.map((r) => r.account.id)).toEqual(["b", "a"]);
    expect(rows[0].balance).toBe(20000);
  });

  it("reflects transactions in the live balance", () => {
    const accounts: Account[] = [card({ name: "Visa", balance: -1000 })];
    const transactions: Transaction[] = [
      {
        id: "t1",
        date: "2026-05-01",
        payee: "Payment",
        category: "Visa Payment",
        amount: 200,
        account: "Visa",
        cleared: true,
      },
    ];
    const [row] = listDebts(accounts, transactions);
    expect(row.balance).toBe(800);
  });
});

describe("summarizeDebts", () => {
  it("sums balances and minimum payments and weights APR by balance", () => {
    const accounts: Account[] = [
      card({ id: "a", balance: -1000, apr: 20, minimumPayment: 35 }),
      loan({
        id: "b",
        balance: -9000,
        loanApr: 5,
        minimumPayment: 175,
      }),
    ];
    const rows = listDebts(accounts, [] as Transaction[]);
    const summary = summarizeDebts(rows);
    expect(summary.count).toBe(2);
    expect(summary.totalBalance).toBe(10000);
    expect(summary.totalMinimumPayment).toBe(210);
    // Weighted APR = (20 * 1000 + 5 * 9000) / 10000 = 6.5
    expect(summary.weightedApr).toBeCloseTo(6.5, 5);
  });

  it("returns null APR when no debt has one set", () => {
    const accounts: Account[] = [
      card({ id: "a", balance: -100, apr: undefined }),
    ];
    const rows = listDebts(accounts, [] as Transaction[]);
    expect(summarizeDebts(rows).weightedApr).toBeNull();
  });
});
