import { describe, expect, it } from "vitest";
import {
  daysUntil,
  nextDueDate,
  ordinalDay,
  upcomingDebtDues,
} from "./debtDueDate";
import type { Account } from "./accounts";

const debt = (overrides: Partial<Account>): Account => ({
  id: overrides.id ?? "a",
  name: overrides.name ?? "Card",
  type: "credit-card",
  balance: 0,
  ...overrides,
});

describe("nextDueDate", () => {
  it("returns the requested day in the current month if still in the future", () => {
    expect(nextDueDate(20, new Date(2026, 4, 13))).toBe("2026-05-20");
  });
  it("returns the same day when today is that day", () => {
    expect(nextDueDate(13, new Date(2026, 4, 13))).toBe("2026-05-13");
  });
  it("rolls forward to next month when this month's day has passed", () => {
    expect(nextDueDate(5, new Date(2026, 4, 13))).toBe("2026-06-05");
  });
  it("clamps day 31 to last day of February", () => {
    expect(nextDueDate(31, new Date(2026, 1, 1))).toBe("2026-02-28");
  });
  it("rejects out-of-range days", () => {
    expect(nextDueDate(0)).toBeNull();
    expect(nextDueDate(32)).toBeNull();
    expect(nextDueDate(Number.NaN)).toBeNull();
  });
});

describe("daysUntil", () => {
  it("0 when target is today", () => {
    expect(daysUntil("2026-05-13", new Date(2026, 4, 13))).toBe(0);
  });
  it("positive into the future, negative into the past", () => {
    expect(daysUntil("2026-05-20", new Date(2026, 4, 13))).toBe(7);
    expect(daysUntil("2026-05-10", new Date(2026, 4, 13))).toBe(-3);
  });
});

describe("ordinalDay", () => {
  it("handles common suffixes", () => {
    expect(ordinalDay(1)).toBe("1st");
    expect(ordinalDay(2)).toBe("2nd");
    expect(ordinalDay(3)).toBe("3rd");
    expect(ordinalDay(4)).toBe("4th");
    expect(ordinalDay(11)).toBe("11th");
    expect(ordinalDay(21)).toBe("21st");
    expect(ordinalDay(22)).toBe("22nd");
  });
});

describe("upcomingDebtDues", () => {
  it("includes debts whose next due falls inside the window, sorted soonest first", () => {
    const today = new Date(2026, 4, 13);
    const accounts: Account[] = [
      debt({ id: "card1", paymentDueDayOfMonth: 15 }), // 2 days
      debt({ id: "loan1", paymentDueDayOfMonth: 20 }), // 7 days
      debt({ id: "card2", paymentDueDayOfMonth: 25 }), // 12 days — out
      debt({ id: "card3" }), // no due day — skipped
    ];
    const out = upcomingDebtDues(accounts, 7, today);
    expect(out.map((d) => d.account.id)).toEqual(["card1", "loan1"]);
    expect(out[0].daysAway).toBe(2);
  });
});
