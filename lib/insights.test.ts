import { describe, expect, it } from "vitest";
import { generateWeeklyInsights } from "./insights";
import type { Transaction } from "./transactions";

const tx = (overrides: Partial<Transaction>): Transaction => ({
  id: overrides.id ?? Math.random().toString(36).slice(2),
  date: overrides.date ?? "2026-05-13",
  payee: overrides.payee ?? "X",
  category: overrides.category ?? "Misc",
  amount: overrides.amount ?? -10,
  account: overrides.account ?? "Checking",
  cleared: overrides.cleared ?? true,
  ...overrides,
});

const wednesday = new Date(2026, 4, 13); // Wed May 13 — week of May 11–17.
const lastWeekDay = "2026-05-06"; // Wed of prior week.

describe("generateWeeklyInsights", () => {
  it("returns no insights when there are no transactions this week", () => {
    expect(generateWeeklyInsights([], wednesday)).toEqual([]);
  });

  it("includes weekly-net with a delta when both weeks have data", () => {
    const txs = [
      tx({ date: "2026-05-13", amount: -50 }),
      tx({ date: lastWeekDay, amount: -100 }),
    ];
    const out = generateWeeklyInsights(txs, wednesday);
    const net = out.find((i) => i.kind === "weekly-net");
    expect(net).toBeTruthy();
    // Two stats: net + vs last week.
    expect(net!.stats).toHaveLength(2);
  });

  it("omits the vs-last-week stat when last week is empty", () => {
    const txs = [tx({ date: "2026-05-13", amount: 200 })];
    const out = generateWeeklyInsights(txs, wednesday);
    const net = out.find((i) => i.kind === "weekly-net");
    expect(net!.stats).toHaveLength(1);
  });

  it("excludes transfers and ready-to-assign rows", () => {
    const txs = [
      tx({ date: "2026-05-13", amount: -50, transferId: "t1" }),
      tx({ date: "2026-05-13", amount: 1000, isReadyToAssign: true }),
    ];
    expect(generateWeeklyInsights(txs, wednesday)).toEqual([]);
  });

  it("reports the top spending category by absolute spend", () => {
    const txs = [
      tx({ date: "2026-05-12", category: "Groceries", amount: -120 }),
      tx({ date: "2026-05-13", category: "Groceries", amount: -40 }),
      tx({ date: "2026-05-13", category: "Gas", amount: -50 }),
    ];
    const out = generateWeeklyInsights(txs, wednesday);
    const top = out.find((i) => i.kind === "top-category");
    expect(top?.title).toContain("Groceries");
  });

  it("surfaces a biggest-expense only when it outpaces the median", () => {
    // Three similar outflows + one outlier 5× larger → outlier surfaces.
    const txs = [
      tx({ date: "2026-05-11", amount: -20 }),
      tx({ date: "2026-05-12", amount: -22 }),
      tx({ date: "2026-05-13", amount: -25 }),
      tx({ date: "2026-05-14", amount: -200, payee: "Costco" }),
    ];
    const out = generateWeeklyInsights(txs, wednesday);
    const big = out.find((i) => i.kind === "biggest-expense");
    expect(big?.title).toContain("Costco");
  });

  it("does NOT surface biggest-expense when amounts are uniform", () => {
    const txs = [
      tx({ date: "2026-05-11", amount: -50 }),
      tx({ date: "2026-05-12", amount: -52 }),
      tx({ date: "2026-05-13", amount: -48 }),
    ];
    const out = generateWeeklyInsights(txs, wednesday);
    expect(out.find((i) => i.kind === "biggest-expense")).toBeUndefined();
  });
});
