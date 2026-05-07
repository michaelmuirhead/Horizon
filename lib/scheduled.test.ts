import { describe, expect, it } from "vitest";
import {
  advanceDate,
  upcomingOccurrences,
  type ScheduledTransaction,
} from "./scheduled";

const monthlyRent: ScheduledTransaction = {
  id: "rent",
  kind: "transaction",
  cadence: "monthly",
  nextDate: "2026-05-01",
  payee: "Landlord",
  category: "Rent/Mortgage",
  amount: -1500,
  account: "Checking",
};

const weeklyAllowance: ScheduledTransaction = {
  id: "allowance",
  kind: "transaction",
  cadence: "weekly",
  nextDate: "2026-05-04",
  payee: "Self",
  category: "Eating Out",
  amount: -50,
  account: "Checking",
};

describe("advanceDate", () => {
  it("rolls a monthly cadence forward by one month", () => {
    expect(advanceDate("2026-05-04", "monthly")).toBe("2026-06-04");
  });
  it("handles year wrap on yearly cadence", () => {
    expect(advanceDate("2026-12-31", "yearly")).toBe("2027-12-31");
  });
});

describe("upcomingOccurrences", () => {
  it("expands a weekly schedule into multiple hits in a 30-day window", () => {
    const out = upcomingOccurrences(
      [weeklyAllowance],
      "2026-05-01",
      "2026-05-31",
    );
    // 5/4, 5/11, 5/18, 5/25 → 4 hits.
    expect(out.map((o) => o.date)).toEqual([
      "2026-05-04",
      "2026-05-11",
      "2026-05-18",
      "2026-05-25",
    ]);
  });

  it("interleaves multiple schedules and sorts by date", () => {
    const out = upcomingOccurrences(
      [monthlyRent, weeklyAllowance],
      "2026-05-01",
      "2026-05-15",
    );
    expect(out[0].date).toBe("2026-05-01");
    for (let i = 1; i < out.length; i++) {
      expect(out[i].date >= out[i - 1].date).toBe(true);
    }
  });

  it("keeps occurrences inside the window even when nextDate is in the past", () => {
    const overdue: ScheduledTransaction = {
      ...monthlyRent,
      nextDate: "2026-04-15",
    };
    const out = upcomingOccurrences(overdue ? [overdue] : [], "2026-04-01", "2026-05-31");
    expect(out.map((o) => o.date)).toEqual(["2026-04-15", "2026-05-15"]);
  });
});
