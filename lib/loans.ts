// Standard amortization math: a loan with principal P, monthly rate r, and
// n payments has a level monthly payment of P * r / (1 - (1+r)^-n). When
// r is 0, the payment is simply P / n.
export function monthlyPayment(
  principal: number,
  annualRatePct: number,
  termMonths: number,
): number {
  if (termMonths <= 0) return 0;
  const r = annualRatePct / 100 / 12;
  if (r === 0) return principal / termMonths;
  return (principal * r) / (1 - Math.pow(1 + r, -termMonths));
}

export type AmortizationStep = {
  index: number; // 1-based payment number
  payment: number;
  interest: number;
  principal: number;
  balance: number; // remaining balance after this payment
};

export function amortizationSchedule(
  principal: number,
  annualRatePct: number,
  termMonths: number,
  maxRows: number = 24,
): AmortizationStep[] {
  if (termMonths <= 0 || principal <= 0) return [];
  const r = annualRatePct / 100 / 12;
  const payment = monthlyPayment(principal, annualRatePct, termMonths);
  let balance = principal;
  const steps: AmortizationStep[] = [];
  const limit = Math.min(maxRows, termMonths);
  for (let i = 1; i <= limit; i++) {
    const interest = r === 0 ? 0 : balance * r;
    const principalPaid = Math.min(payment - interest, balance);
    balance = Math.max(0, balance - principalPaid);
    steps.push({
      index: i,
      payment: principalPaid + interest,
      interest,
      principal: principalPaid,
      balance,
    });
    if (balance === 0) break;
  }
  return steps;
}

export function totalInterestOverLife(
  principal: number,
  annualRatePct: number,
  termMonths: number,
): number {
  return monthlyPayment(principal, annualRatePct, termMonths) * termMonths - principal;
}

// Split a single loan payment into the interest accrued this cycle vs. the
// remainder that pays down principal. Pads to two decimals so the two parts
// always sum to exactly the requested payment.
export function splitLoanPayment(
  outstandingBalance: number,
  annualRatePct: number,
  payment: number,
): { interest: number; principal: number } {
  if (payment <= 0 || outstandingBalance <= 0) {
    return { interest: 0, principal: Math.max(0, payment) };
  }
  const r = annualRatePct / 100 / 12;
  const rawInterest = Math.min(payment, outstandingBalance * r);
  const interest = Math.round(rawInterest * 100) / 100;
  // The principal absorbs any rounding remainder so payment === interest + principal.
  const principal = Math.round((payment - interest) * 100) / 100;
  return { interest, principal };
}
