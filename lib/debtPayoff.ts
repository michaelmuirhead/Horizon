// Debt-payoff simulator. Compares snowball (pay smallest balance first)
// vs avalanche (pay highest APR first), given each debt's balance, APR,
// and required minimum payment plus the user's extra monthly budget.
// Pure function over inputs — no clock dep, easy to unit-test.

export type PayoffDebt = {
  id: string;
  // Display name only; the math runs on id.
  name: string;
  // Current balance, positive.
  balance: number;
  // APR as a percent (e.g. 18.99). Zero means no interest accrues.
  aprPercent: number;
  // Minimum payment, positive. If 0, the debt gets only the strategy's
  // extra allocation — possibly never paid off if extra is also 0.
  minPayment: number;
};

export type PayoffStrategy = "snowball" | "avalanche";

export type PayoffResult = {
  strategy: PayoffStrategy;
  monthsToPayoff: number;
  totalInterest: number;
  totalPaid: number;
  // Per-debt outcome keyed by debt id.
  perDebt: Record<
    string,
    { paidOffMonth: number | null; interestPaid: number; principalPaid: number }
  >;
  // True if the simulation hit the iteration cap before paying everything
  // off — usually means minimums + extra don't cover monthly interest.
  diverged: boolean;
};

// Cap at 50 years. Past that, the user's situation is structurally
// underwater (minimums don't cover interest) and we should stop pretending
// the simulation has a finite answer.
const MAX_MONTHS = 600;

// Order debts according to the strategy. Within tie groups we fall back
// to highest APR (snowball) / smallest balance (avalanche) so the order
// is deterministic and intuitive.
function strategyOrder(
  debts: PayoffDebt[],
  strategy: PayoffStrategy,
): PayoffDebt[] {
  const out = debts.slice();
  if (strategy === "snowball") {
    out.sort((a, b) =>
      a.balance !== b.balance
        ? a.balance - b.balance
        : b.aprPercent - a.aprPercent,
    );
  } else {
    out.sort((a, b) =>
      a.aprPercent !== b.aprPercent
        ? b.aprPercent - a.aprPercent
        : a.balance - b.balance,
    );
  }
  return out;
}

export function simulatePayoff(
  debts: PayoffDebt[],
  extraPerMonth: number,
  strategy: PayoffStrategy,
): PayoffResult {
  // Working copy: we mutate `balance` per month.
  const active = debts
    .filter((d) => d.balance > 0)
    .map((d) => ({ ...d }));
  const perDebt: PayoffResult["perDebt"] = {};
  for (const d of debts) {
    perDebt[d.id] = {
      paidOffMonth: d.balance <= 0 ? 0 : null,
      interestPaid: 0,
      principalPaid: 0,
    };
  }

  let months = 0;
  let totalInterest = 0;
  let totalPaid = 0;

  while (active.some((d) => d.balance > 0)) {
    if (months >= MAX_MONTHS) {
      return {
        strategy,
        monthsToPayoff: months,
        totalInterest,
        totalPaid,
        perDebt,
        diverged: true,
      };
    }
    months += 1;

    // 1. Accrue one month of interest on every remaining debt.
    for (const d of active) {
      if (d.balance <= 0) continue;
      const monthlyRate = d.aprPercent / 100 / 12;
      const accrued = d.balance * monthlyRate;
      d.balance += accrued;
      totalInterest += accrued;
      perDebt[d.id].interestPaid += accrued;
    }

    // 2. Pay minimums on every remaining debt. If a minimum exceeds the
    //    balance, only the balance gets paid (the rest "rolls" into the
    //    extra-payment pool below).
    let pool = extraPerMonth;
    for (const d of active) {
      if (d.balance <= 0) continue;
      const minTaken = Math.min(d.minPayment, d.balance);
      d.balance -= minTaken;
      totalPaid += minTaken;
      perDebt[d.id].principalPaid += minTaken;
      if (d.minPayment > minTaken) {
        // Freed up by the balance being smaller than the minimum.
        pool += d.minPayment - minTaken;
      }
    }

    // 3. Apply the extra-payment pool in strategy order. Spillover when a
    //    debt is fully paid moves on to the next target — this is the
    //    "snowball" / "avalanche" rollover effect.
    const ordered = strategyOrder(active, strategy);
    for (const d of ordered) {
      if (pool <= 0) break;
      if (d.balance <= 0) continue;
      const applied = Math.min(d.balance, pool);
      d.balance -= applied;
      pool -= applied;
      totalPaid += applied;
      perDebt[d.id].principalPaid += applied;
    }

    // 4. Mark anything newly cleared.
    for (const d of active) {
      if (d.balance <= 0 && perDebt[d.id].paidOffMonth === null) {
        perDebt[d.id].paidOffMonth = months;
      }
    }
  }

  return {
    strategy,
    monthsToPayoff: months,
    totalInterest,
    totalPaid,
    perDebt,
    diverged: false,
  };
}

// Returns the difference avalanche saves over snowball (in interest +
// in months). Useful for the "Avalanche saves $X / Y months" line.
export function compareStrategies(
  debts: PayoffDebt[],
  extraPerMonth: number,
): { snowball: PayoffResult; avalanche: PayoffResult } {
  return {
    snowball: simulatePayoff(debts, extraPerMonth, "snowball"),
    avalanche: simulatePayoff(debts, extraPerMonth, "avalanche"),
  };
}
