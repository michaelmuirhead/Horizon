import { describe, expect, it } from "vitest";
import { compareStrategies, simulatePayoff } from "./debtPayoff";

describe("simulatePayoff", () => {
  it("pays off a single zero-interest debt in balance / min months", () => {
    const out = simulatePayoff(
      [{ id: "a", name: "A", balance: 1000, aprPercent: 0, minPayment: 100 }],
      0,
      "snowball",
    );
    expect(out.monthsToPayoff).toBe(10);
    expect(out.totalInterest).toBe(0);
    expect(out.perDebt.a.paidOffMonth).toBe(10);
  });

  it("avalanche pays off higher-APR first", () => {
    const debts = [
      { id: "lo", name: "Lo APR", balance: 1000, aprPercent: 5, minPayment: 25 },
      { id: "hi", name: "Hi APR", balance: 1000, aprPercent: 24, minPayment: 25 },
    ];
    const out = simulatePayoff(debts, 200, "avalanche");
    // hi is paid off before lo.
    expect(out.perDebt.hi.paidOffMonth).not.toBeNull();
    expect(out.perDebt.lo.paidOffMonth).not.toBeNull();
    expect(out.perDebt.hi.paidOffMonth! < out.perDebt.lo.paidOffMonth!).toBe(
      true,
    );
  });

  it("snowball pays off smaller-balance first even at lower APR", () => {
    const debts = [
      { id: "small", name: "Small", balance: 500, aprPercent: 5, minPayment: 25 },
      { id: "large", name: "Large", balance: 5000, aprPercent: 24, minPayment: 100 },
    ];
    const out = simulatePayoff(debts, 200, "snowball");
    expect(out.perDebt.small.paidOffMonth! < out.perDebt.large.paidOffMonth!).toBe(
      true,
    );
  });

  it("avalanche typically beats snowball on total interest", () => {
    const debts = [
      { id: "small", name: "Small", balance: 500, aprPercent: 5, minPayment: 25 },
      { id: "large", name: "Large", balance: 5000, aprPercent: 24, minPayment: 100 },
    ];
    const { snowball, avalanche } = compareStrategies(debts, 200);
    expect(avalanche.totalInterest).toBeLessThanOrEqual(snowball.totalInterest);
  });

  it("flags divergence when minimum < monthly interest and no extra is provided", () => {
    const out = simulatePayoff(
      [
        {
          id: "x",
          name: "Underwater",
          balance: 1000,
          aprPercent: 24,
          minPayment: 5,
        },
      ],
      0,
      "snowball",
    );
    expect(out.diverged).toBe(true);
  });

  it("skips debts already at zero balance", () => {
    const out = simulatePayoff(
      [
        { id: "a", name: "A", balance: 0, aprPercent: 5, minPayment: 50 },
        { id: "b", name: "B", balance: 100, aprPercent: 0, minPayment: 50 },
      ],
      0,
      "snowball",
    );
    expect(out.monthsToPayoff).toBe(2);
    expect(out.perDebt.a.paidOffMonth).toBe(0);
    expect(out.perDebt.b.paidOffMonth).toBe(2);
  });
});
