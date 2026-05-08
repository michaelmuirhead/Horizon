import { describe, expect, it } from "vitest";
import {
  daysUntilDue,
  isReached,
  monthlyPaceNeeded,
  progressPct,
  remainingAmount,
  savedAmount,
  sortGoalsByProgress,
  summarizeGoals,
  type SavingsGoal,
} from "./savingsGoals";

function goal(overrides: Partial<SavingsGoal> = {}): SavingsGoal {
  return {
    id: "g1",
    name: "Trip",
    targetAmount: 1000,
    contributions: [],
    createdAt: "2026-01-01",
    ...overrides,
  };
}

describe("savedAmount", () => {
  it("sums contributions, allowing positive and negative entries", () => {
    expect(
      savedAmount(
        goal({
          contributions: [
            { id: "a", date: "2026-02-01", amount: 200 },
            { id: "b", date: "2026-03-01", amount: 50 },
            { id: "c", date: "2026-04-01", amount: -75 },
          ],
        }),
      ),
    ).toBe(175);
  });
  it("rounds to cents", () => {
    expect(
      savedAmount(
        goal({
          contributions: [
            { id: "a", date: "2026-02-01", amount: 0.1 },
            { id: "b", date: "2026-02-02", amount: 0.2 },
          ],
        }),
      ),
    ).toBe(0.3);
  });
});

describe("remainingAmount / progressPct / isReached", () => {
  const g = goal({
    targetAmount: 500,
    contributions: [{ id: "a", date: "2026-02-01", amount: 200 }],
  });

  it("computes a remaining balance", () => {
    expect(remainingAmount(g)).toBe(300);
  });

  it("returns a clamped progress percent", () => {
    expect(progressPct(g)).toBe(40);
  });

  it("clamps over-funded goals at 100%", () => {
    const reached = goal({
      targetAmount: 100,
      contributions: [{ id: "a", date: "2026-02-01", amount: 250 }],
    });
    expect(progressPct(reached)).toBe(100);
    expect(remainingAmount(reached)).toBe(0);
    expect(isReached(reached)).toBe(true);
  });

  it("returns false for isReached when nothing has been saved", () => {
    expect(isReached(g)).toBe(false);
  });
});

describe("daysUntilDue", () => {
  it("returns null when there's no due date", () => {
    expect(daysUntilDue(goal())).toBeNull();
  });

  it("counts days from today, negative when overdue", () => {
    const today = new Date(2026, 4, 8); // 2026-05-08
    expect(
      daysUntilDue(goal({ dueDate: "2026-05-15" }), today),
    ).toBe(7);
    expect(
      daysUntilDue(goal({ dueDate: "2026-05-01" }), today),
    ).toBe(-7);
    expect(
      daysUntilDue(goal({ dueDate: "2026-05-08" }), today),
    ).toBe(0);
  });
});

describe("monthlyPaceNeeded", () => {
  it("divides remaining by months between today and due", () => {
    const today = new Date(2026, 0, 1); // Jan 1 2026
    const g = goal({
      targetAmount: 1200,
      dueDate: "2026-06-01",
      contributions: [{ id: "a", date: "2026-01-01", amount: 200 }],
    });
    // Remaining = 1000, monthsLeft = 5 → 200/mo.
    expect(monthlyPaceNeeded(g, today)).toBeCloseTo(200, 5);
  });

  it("returns null when there's no due date or already funded", () => {
    expect(monthlyPaceNeeded(goal())).toBeNull();
    expect(
      monthlyPaceNeeded(
        goal({
          dueDate: "2030-01-01",
          contributions: [{ id: "a", date: "2026-01-01", amount: 9999 }],
        }),
      ),
    ).toBeNull();
  });
});

describe("sortGoalsByProgress", () => {
  it("puts active least-funded goals first and reached goals last", () => {
    const g1 = goal({
      id: "a",
      contributions: [{ id: "x", date: "2026-01-01", amount: 200 }],
    });
    const g2 = goal({
      id: "b",
      contributions: [{ id: "y", date: "2026-01-01", amount: 50 }],
    });
    const g3 = goal({
      id: "c",
      targetAmount: 100,
      contributions: [{ id: "z", date: "2026-01-01", amount: 150 }],
    });
    const sorted = sortGoalsByProgress([g1, g2, g3]);
    expect(sorted.map((g) => g.id)).toEqual(["b", "a", "c"]);
  });
});

describe("summarizeGoals", () => {
  it("aggregates totals across goals", () => {
    const goals: SavingsGoal[] = [
      goal({
        id: "a",
        targetAmount: 500,
        contributions: [{ id: "x", date: "2026-01-01", amount: 100 }],
      }),
      goal({
        id: "b",
        targetAmount: 200,
        contributions: [{ id: "y", date: "2026-01-01", amount: 250 }],
      }),
    ];
    const s = summarizeGoals(goals);
    expect(s.count).toBe(2);
    expect(s.totalTarget).toBe(700);
    expect(s.totalSaved).toBe(350);
    expect(s.reachedCount).toBe(1);
  });
});
