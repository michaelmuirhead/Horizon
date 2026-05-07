import { describe, expect, it } from "vitest";
import {
  amortizationSchedule,
  monthlyPayment,
  splitLoanPayment,
  totalInterestOverLife,
} from "./loans";

describe("monthlyPayment", () => {
  it("matches the standard PMT formula", () => {
    // $200k @ 6% APR for 30 years ~= $1199.10
    expect(monthlyPayment(200000, 6, 360)).toBeCloseTo(1199.1, 1);
  });
  it("falls back to even split when APR is zero", () => {
    expect(monthlyPayment(1200, 0, 12)).toBeCloseTo(100, 5);
  });
  it("returns zero on an empty term", () => {
    expect(monthlyPayment(1000, 5, 0)).toBe(0);
  });
});

describe("amortizationSchedule", () => {
  it("zeros out the balance by the last payment", () => {
    const steps = amortizationSchedule(1200, 0, 12, 12);
    expect(steps).toHaveLength(12);
    expect(steps[steps.length - 1].balance).toBeCloseTo(0, 5);
    const totalPrincipal = steps.reduce((s, x) => s + x.principal, 0);
    expect(totalPrincipal).toBeCloseTo(1200, 5);
  });

  it("front-loads interest at higher APRs", () => {
    const steps = amortizationSchedule(200000, 6, 360, 12);
    expect(steps[0].interest).toBeGreaterThan(steps[0].principal);
    expect(steps[steps.length - 1].interest).toBeGreaterThan(
      steps[steps.length - 1].principal,
    );
  });

  it("respects the maxRows cap", () => {
    const steps = amortizationSchedule(1000, 5, 60, 5);
    expect(steps).toHaveLength(5);
  });
});

describe("splitLoanPayment", () => {
  it("matches the first amortization step's interest at full balance", () => {
    const split = splitLoanPayment(200000, 6, 1199.1);
    // 200000 * 0.005 = 1000 of interest, leaving ~199.10 of principal.
    expect(split.interest).toBeCloseTo(1000, 2);
    expect(split.principal).toBeCloseTo(199.1, 2);
  });

  it("treats a zero-APR loan as all-principal", () => {
    const split = splitLoanPayment(1200, 0, 100);
    expect(split.interest).toBe(0);
    expect(split.principal).toBe(100);
  });

  it("caps interest at the outstanding balance for a final payment", () => {
    const split = splitLoanPayment(50, 6, 200);
    // Interest can't be more than what's owed, and principal absorbs the
    // remainder so interest + principal === payment.
    expect(split.interest).toBeLessThanOrEqual(50);
    expect(split.interest + split.principal).toBeCloseTo(200, 5);
  });

  it("preserves the rounding remainder on principal", () => {
    const split = splitLoanPayment(123456.78, 5.99, 987.65);
    expect(split.interest + split.principal).toBeCloseTo(987.65, 5);
  });
});

describe("totalInterestOverLife", () => {
  it("is positive for any positive APR", () => {
    expect(totalInterestOverLife(200000, 6, 360)).toBeGreaterThan(0);
  });
  it("is zero at 0%", () => {
    expect(totalInterestOverLife(1200, 0, 12)).toBeCloseTo(0, 5);
  });
});
