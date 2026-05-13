export type TransactionSplit = {
  category: string;
  // Signs match the parent transaction — outflows are negative.
  amount: number;
};

export type Transaction = {
  id: string;
  date: string; // ISO YYYY-MM-DD
  payee: string;
  // For split transactions, this is "Split" and the actual categories live in
  // splits[]. The top-level amount equals the sum of split amounts.
  // For transfers, this is "Transfer" and the row is paired with another
  // transaction sharing the same transferId.
  category: string;
  amount: number; // negative = outflow, positive = inflow
  account: string;
  cleared: boolean;
  // True once the user has confirmed the row matches their bank during a
  // reconcile. Flagged rows shouldn't be edited without an explicit warning.
  reconciled?: boolean;
  memo?: string;
  isReadyToAssign?: boolean;
  splits?: TransactionSplit[];
  transferId?: string;
  // Free-form labels for cross-cutting reporting ("vacation 2026",
  // "tax-deductible"). Stored lowercased; never includes empty strings.
  tags?: string[];
  // Receipt photo / document. Either an inline data URL (legacy /
  // local-only mode) or an https Firebase Storage download URL (when
  // Cloud Sync + auth are wired up). The parallel storage path lets
  // the UI clean up the Storage object on replace / remove; absent
  // for legacy inline values.
  receiptDataUrl?: string;
  receiptStoragePath?: string;
};

export function normalizeTags(input: string[] | undefined): string[] | undefined {
  if (!input || input.length === 0) return undefined;
  const cleaned = Array.from(
    new Set(
      input
        .map((t) => t.trim().toLowerCase())
        .filter((t) => t.length > 0 && t.length <= 40),
    ),
  );
  return cleaned.length === 0 ? undefined : cleaned;
}

export function parseTagsInput(raw: string): string[] {
  return raw
    .split(/[,\n]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

export function uniqueTags(transactions: Transaction[]): { name: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const t of transactions) {
    if (!t.tags) continue;
    for (const tag of t.tags) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }
  return Array.from(counts.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => (b.count !== a.count ? b.count - a.count : a.name < b.name ? -1 : 1));
}

export const SPLIT_CATEGORY = "Split";
export const TRANSFER_CATEGORY = "Transfer";

// The most recent category seen for transactions with this payee (case-
// insensitive). Skips structural categories (Split, Transfer, RTA, Tracking)
// since those aren't user-pickable. Returns null when no match.
export function lastCategoryForPayee(
  transactions: Transaction[],
  payee: string,
  excludeCategories: ReadonlySet<string> = new Set([
    SPLIT_CATEGORY,
    TRANSFER_CATEGORY,
    "Tracking",
  ]),
): string | null {
  const needle = payee.trim().toLowerCase();
  if (needle === "") return null;
  const sorted = [...transactions].sort((a, b) =>
    a.date < b.date ? 1 : a.date > b.date ? -1 : 0,
  );
  for (const t of sorted) {
    if (t.isReadyToAssign) continue;
    if (t.transferId) continue;
    if (t.payee.trim().toLowerCase() !== needle) continue;
    if (excludeCategories.has(t.category)) continue;
    return t.category;
  }
  return null;
}

export type CcRoutingCtx = {
  // For accounts that are credit cards with a paired payment category, return
  // that category's name. Returning null/undefined means the account isn't a
  // CC and CC routing doesn't apply.
  ccPaymentCategoryFor?: (accountName: string) => string | null | undefined;
};

export function txContributionsToCategory(
  tx: Transaction,
  categoryName: string,
  ctx?: CcRoutingCtx,
): number {
  // Income contributes nothing to any envelope.
  if (tx.isReadyToAssign) return 0;

  const ccPaymentCat = ctx?.ccPaymentCategoryFor?.(tx.account) ?? null;

  if (tx.transferId) {
    // The reverse CC leg: a transfer landing on a credit-card account (the
    // inflow half of "pay the bill from checking") drains that card's
    // payment envelope by the same amount. The outflow half on the source
    // account contributes nothing.
    if (ccPaymentCat && tx.amount > 0 && categoryName === ccPaymentCat) {
      return -tx.amount;
    }
    return 0;
  }

  if (tx.splits && tx.splits.length > 0) {
    let sum = 0;
    for (const s of tx.splits) {
      if (s.category === categoryName) sum += s.amount;
      // CC routing: a split outflow on a credit card moves money from the
      // spending category to the CC's payment category (positive contribution).
      if (
        ccPaymentCat &&
        s.amount < 0 &&
        s.category !== ccPaymentCat &&
        categoryName === ccPaymentCat
      ) {
        sum += -s.amount;
      }
    }
    return sum;
  }

  // Non-split path: same logic for the parent.
  if (
    ccPaymentCat &&
    tx.amount < 0 &&
    tx.category !== ccPaymentCat &&
    categoryName === ccPaymentCat
  ) {
    return -tx.amount;
  }
  return tx.category === categoryName ? tx.amount : 0;
}

export const sampleTransactions: Transaction[] = [
  {
    id: "tx-1",
    date: "2026-05-04",
    payee: "Kroger",
    category: "Groceries",
    amount: -100,
    account: "USAA",
    cleared: true,
  },
  {
    id: "tx-2",
    date: "2026-05-04",
    payee: "Starting Balance",
    category: "Income: Ready to Assign",
    amount: 2100,
    account: "USAA",
    cleared: true,
    isReadyToAssign: true,
  },
];

export function groupByDate(transactions: Transaction[]): Array<{
  date: string;
  items: Transaction[];
}> {
  const map = new Map<string, Transaction[]>();
  for (const t of transactions) {
    const list = map.get(t.date) ?? [];
    list.push(t);
    map.set(t.date, list);
  }
  return Array.from(map.entries())
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([date, items]) => ({ date, items }));
}

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "long",
  day: "numeric",
  year: "numeric",
});

export function formatTransactionDate(iso: string): string {
  // ISO YYYY-MM-DD parsed as local date (avoid TZ shift).
  const [y, m, d] = iso.split("-").map(Number);
  return dateFormatter.format(new Date(y, m - 1, d));
}
