import { describe, expect, it } from "vitest";
import { detectSubscriptions, totalMonthlySubscriptions } from "./subscriptions";
import type { Transaction } from "./transactions";

function tx(
  payee: string,
  date: string,
  amount: number,
  category = "Subscriptions",
): Transaction {
  return {
    id: `${payee}-${date}`,
    date,
    payee,
    category,
    amount,
    account: "USAA",
    cleared: true,
  };
}

describe("detectSubscriptions", () => {
  it("identifies a payee with three monthly charges of similar amount", () => {
    const out = detectSubscriptions([
      tx("Spotify", "2026-03-12", -10.99),
      tx("Spotify", "2026-04-12", -10.99),
      tx("Spotify", "2026-05-12", -10.99),
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].payee).toBe("Spotify");
    expect(out[0].averageAmount).toBeCloseTo(10.99, 2);
    expect(out[0].hits).toBe(3);
  });

  it("ignores payees with fewer than the threshold occurrences", () => {
    const out = detectSubscriptions([
      tx("Netflix", "2026-04-15", -15.99),
      tx("Netflix", "2026-05-15", -15.99),
    ]);
    expect(out).toHaveLength(0);
  });

  it("ignores payees whose charges drift wildly", () => {
    const out = detectSubscriptions([
      tx("Amazon", "2026-03-01", -3),
      tx("Amazon", "2026-04-01", -150),
      tx("Amazon", "2026-05-01", -22),
    ]);
    expect(out).toHaveLength(0);
  });

  it("ignores transfers, splits, RTA inflows", () => {
    const out = detectSubscriptions([
      { ...tx("X", "2026-03-01", -10), transferId: "t1" },
      { ...tx("X", "2026-04-01", -10), transferId: "t2" },
      { ...tx("X", "2026-05-01", -10), transferId: "t3" },
    ]);
    expect(out).toHaveLength(0);
  });

  it("ignores non-monthly cadence (weekly groceries)", () => {
    const out = detectSubscriptions([
      tx("Kroger", "2026-04-01", -50),
      tx("Kroger", "2026-04-08", -50),
      tx("Kroger", "2026-04-15", -50),
      tx("Kroger", "2026-04-22", -50),
    ]);
    expect(out).toHaveLength(0);
  });

  it("totalMonthlySubscriptions sums the averages", () => {
    const out = detectSubscriptions([
      tx("Spotify", "2026-03-12", -10.99),
      tx("Spotify", "2026-04-12", -10.99),
      tx("Spotify", "2026-05-12", -10.99),
      tx("Notion", "2026-03-05", -8),
      tx("Notion", "2026-04-05", -8),
      tx("Notion", "2026-05-05", -8),
    ]);
    expect(out).toHaveLength(2);
    expect(totalMonthlySubscriptions(out)).toBeCloseTo(18.99, 2);
  });
});
