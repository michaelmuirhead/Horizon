import {
  type Account,
  LIABILITY_ACCOUNT_TYPES,
  liveAccountBalance,
} from "./accounts";
import { monthlyPayment } from "./loans";
import type { Transaction } from "./transactions";

export type DebtRow = {
  account: Account;
  // Outstanding amount owed, always positive.
  balance: number;
  // Annual percentage rate as a number (e.g. 6.5 for 6.5%), or null if unknown.
  apr: number | null;
  // Monthly minimum payment in dollars, or null if unknown. For loans with a
  // term but no user-set minimum, this is the standard amortized payment.
  minimumPayment: number | null;
  // True when the minimum payment was estimated from amortization rather
  // than set by the user. Useful for surfacing "estimate" hints in the UI.
  minimumIsEstimated: boolean;
};

export function isDebtAccount(account: Account): boolean {
  return LIABILITY_ACCOUNT_TYPES.has(account.type);
}

export function debtApr(account: Account): number | null {
  if (typeof account.apr === "number") return account.apr;
  if (account.type === "loan" && typeof account.loanApr === "number") {
    return account.loanApr;
  }
  return null;
}

export function debtMinimumPayment(
  account: Account,
  outstandingBalance: number,
): { value: number | null; estimated: boolean } {
  if (typeof account.minimumPayment === "number") {
    return { value: account.minimumPayment, estimated: false };
  }
  if (
    account.type === "loan" &&
    typeof account.loanApr === "number" &&
    typeof account.loanTermMonths === "number" &&
    account.loanTermMonths > 0 &&
    outstandingBalance > 0
  ) {
    const principal = account.loanOriginalPrincipal ?? outstandingBalance;
    return {
      value: monthlyPayment(principal, account.loanApr, account.loanTermMonths),
      estimated: true,
    };
  }
  return { value: null, estimated: false };
}

export function listDebts(
  accounts: Account[],
  transactions: Transaction[],
): DebtRow[] {
  const rows: DebtRow[] = [];
  for (const account of accounts) {
    if (!isDebtAccount(account) || account.closed) continue;
    const balance = Math.abs(liveAccountBalance(account, transactions));
    const min = debtMinimumPayment(account, balance);
    rows.push({
      account,
      balance,
      apr: debtApr(account),
      minimumPayment: min.value,
      minimumIsEstimated: min.estimated,
    });
  }
  // Highest balance first so the costliest debts surface at the top.
  rows.sort((a, b) => b.balance - a.balance);
  return rows;
}

export type DebtsSummary = {
  totalBalance: number;
  totalMinimumPayment: number;
  // Balance-weighted average APR across debts that have an APR set.
  // Null when no debt has an APR — avoids printing a misleading 0%.
  weightedApr: number | null;
  count: number;
};

export function summarizeDebts(rows: DebtRow[]): DebtsSummary {
  let totalBalance = 0;
  let totalMin = 0;
  let aprWeightedSum = 0;
  let aprWeightTotal = 0;
  for (const row of rows) {
    totalBalance += row.balance;
    if (row.minimumPayment !== null) totalMin += row.minimumPayment;
    if (row.apr !== null && row.balance > 0) {
      aprWeightedSum += row.apr * row.balance;
      aprWeightTotal += row.balance;
    }
  }
  return {
    totalBalance,
    totalMinimumPayment: totalMin,
    weightedApr: aprWeightTotal > 0 ? aprWeightedSum / aprWeightTotal : null,
    count: rows.length,
  };
}
