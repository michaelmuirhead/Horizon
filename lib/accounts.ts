export type AccountType =
  | "cash"
  | "checking"
  | "savings"
  | "investment"
  | "credit-card"
  | "loan";

export type InvestmentValuation = {
  id: string;
  date: string; // ISO YYYY-MM-DD
  // Total account market value on this date. Replaces the previous
  // valuation rather than netting against it.
  value: number;
  note?: string;
};

export type Account = {
  id: string;
  name: string;
  type: AccountType;
  // Starting balance set when the account was added. Live balance is
  // starting balance plus all transactions tagged to this account.
  balance: number;
  note?: string;
  closed?: boolean;
  // Tracking (off-budget) accounts contribute to net worth but their
  // transactions don't flow through Ready to Assign or category envelopes.
  tracking?: boolean;
  // Credit-card accounts auto-create a paired payment category to fund
  // future bill payments from. This points to that category's id.
  ccPaymentCategoryId?: string;
  // Loan amortization inputs. Only meaningful for type "loan".
  loanApr?: number; // annual percentage rate, e.g. 6.5 for 6.5%
  loanTermMonths?: number;
  loanOriginalPrincipal?: number;
  // Generic debt terms used by the Debts list. For loans, `apr` falls back
  // to `loanApr`; for credit cards there's no other source. `minimumPayment`
  // is the user-stated monthly minimum. Both are optional — the Debts page
  // surfaces missing values so the user can fill them in.
  apr?: number;
  minimumPayment?: number;
  // Day of the month the next payment is due (1..31). Recurring — we
  // derive the next-due calendar date by combining this with today.
  // Values that exceed the month's last day clamp to the last day
  // (e.g. day 31 on April resolves to April 30) so users can say
  // "always due on the 31st" without losing months.
  paymentDueDayOfMonth?: number;
  // Stable id of the asset account that should fund the scheduled
  // payment for this debt. We resolve from id (not name) so renaming
  // the source account doesn't silently break the schedule.
  defaultFundingAccountId?: string;
  // Investment account history of self-reported values. The most recent
  // entry's value is what `liveAccountBalance` returns when populated.
  // Net contributions (sum of transactions on this account) are tracked
  // separately so we can compute gain/loss = currentValue - contributions.
  investmentValuations?: InvestmentValuation[];
};

export const CC_PAYMENTS_GROUP_NAME = "Credit Card Payments";

export type Reconciliation = {
  id: string;
  accountId: string;
  date: string; // ISO YYYY-MM-DD
  bankBalance: number;
  // The adjustment transaction created (signed). 0 means no adjustment was needed.
  adjustment: number;
};

export function trackingAccountNames(accounts: Account[]): Set<string> {
  const out = new Set<string>();
  for (const a of accounts) if (a.tracking) out.add(a.name);
  return out;
}

export function activeAccounts(accounts: Account[]): Account[] {
  return accounts.filter((a) => !a.closed);
}

export const accountTypeOrder: AccountType[] = [
  "cash",
  "checking",
  "savings",
  "investment",
  "credit-card",
  "loan",
];

export const accountTypeLabels: Record<AccountType, string> = {
  cash: "Cash",
  checking: "Checking",
  savings: "Savings",
  investment: "Investments",
  "credit-card": "Credit Cards",
  loan: "Loans",
};

export const accountTypeSingularLabels: Record<AccountType, string> = {
  cash: "Cash",
  checking: "Checking",
  savings: "Savings",
  investment: "Investment",
  "credit-card": "Credit Card",
  loan: "Loan",
};

export const ASSET_ACCOUNT_TYPES: ReadonlySet<AccountType> = new Set([
  "cash",
  "checking",
  "savings",
  "investment",
]);
export const LIABILITY_ACCOUNT_TYPES: ReadonlySet<AccountType> = new Set([
  "credit-card",
  "loan",
]);

export const sampleAccounts: Account[] = [
  // Starts at $0; the seed "Starting Balance" transaction adds the +$2100.
  { id: "usaa", name: "USAA", type: "cash", balance: 0 },
];

export type AccountGroup = {
  type: AccountType;
  label: string;
  accounts: Account[];
};

export function groupAccounts(accounts: Account[]): AccountGroup[] {
  const byType = new Map<AccountType, Account[]>();
  for (const a of accounts) {
    if (a.closed) continue;
    const list = byType.get(a.type) ?? [];
    list.push(a);
    byType.set(a.type, list);
  }
  const groups: AccountGroup[] = [];
  for (const type of accountTypeOrder) {
    const accs = byType.get(type);
    if (accs && accs.length > 0) {
      groups.push({ type, label: accountTypeLabels[type], accounts: accs });
    }
  }
  return groups;
}

export function closedAccounts(accounts: Account[]): Account[] {
  return accounts.filter((a) => a.closed);
}

import type { Transaction } from "./transactions";

export function liveAccountBalance(
  account: Account,
  transactions: Transaction[],
): number {
  // Investment accounts use self-reported market values rather than
  // accumulating cash flow. Most-recent valuation wins; if there isn't
  // one, fall back to the contributions running total so a freshly added
  // account still has a meaningful balance.
  if (account.type === "investment" && account.investmentValuations?.length) {
    const sorted = account.investmentValuations
      .slice()
      .sort((a, b) => (a.date < b.date ? 1 : -1));
    return sorted[0].value;
  }
  const txSum = transactions
    .filter((t) => t.account === account.name)
    .reduce((s, t) => s + t.amount, 0);
  return account.balance + txSum;
}

// Sum of every transaction tagged to the account — used as the
// "contributions" denominator for an investment account's gain/loss.
export function totalContributions(
  account: Account,
  transactions: Transaction[],
): number {
  const txSum = transactions
    .filter((t) => t.account === account.name)
    .reduce((s, t) => s + t.amount, 0);
  return account.balance + txSum;
}

export function clearedAccountBalance(
  account: Account,
  transactions: Transaction[],
): number {
  const txSum = transactions
    .filter((t) => t.account === account.name && t.cleared)
    .reduce((s, t) => s + t.amount, 0);
  return account.balance + txSum;
}
