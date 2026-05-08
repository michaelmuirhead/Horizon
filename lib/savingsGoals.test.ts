import { describe, expect, it } from "vitest";
import type { BudgetCategoryGroup } from "./budget";
import {
  daysUntilDue,
  ensureGoalsGroupHasCategory,
  isReached,
  monthlyPaceNeeded,
  progressPct,
  remainingAmount,
  removeSavingsCategoryFromGroups,
  savedAmount,
  sortGoalsByProgress,
  summarizeGoals,
  syncSavingsCategory,
  targetForSavingsGoal,
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

describe("targetForSavingsGoal", () => {
  it("returns a by-date target when the goal has a due date", () => {
    const t = targetForSavingsGoal(
      goal({ targetAmount: 1200, dueDate: "2026-12-01" }),
    );
    expect(t).toEqual({
      kind: "by-date",
      amount: 1200,
      dueDate: "2026-12-01",
    });
  });

  it("falls back to refill when no due date is set", () => {
    expect(targetForSavingsGoal(goal({ targetAmount: 500 }))).toEqual({
      kind: "refill",
      amount: 500,
    });
  });

  it("returns null for non-positive targets", () => {
    expect(targetForSavingsGoal(goal({ targetAmount: 0 }))).toBeNull();
  });
});

describe("ensureGoalsGroupHasCategory", () => {
  const cat = { id: "cat-1", name: "Vacation" };

  it("appends to an existing Goals group identified by id", () => {
    const groups: BudgetCategoryGroup[] = [
      { id: "bills", name: "Bills", categories: [] },
      {
        id: "goals",
        name: "Goals",
        categories: [{ id: "old", name: "Education" }],
      },
    ];
    const next = ensureGoalsGroupHasCategory(groups, cat);
    const goals = next.find((g) => g.id === "goals")!;
    expect(goals.categories.map((c) => c.id)).toEqual(["old", "cat-1"]);
    expect(next).toHaveLength(2);
  });

  it("matches the Goals group by case-insensitive name", () => {
    const groups: BudgetCategoryGroup[] = [
      { id: "custom", name: "GOALS", categories: [] },
    ];
    const next = ensureGoalsGroupHasCategory(groups, cat);
    expect(next[0].categories).toContainEqual(cat);
  });

  it("creates the group when none exists", () => {
    const next = ensureGoalsGroupHasCategory([], cat);
    expect(next).toEqual([
      { id: "goals", name: "Goals", categories: [cat] },
    ]);
  });
});

describe("syncSavingsCategory", () => {
  const groups: BudgetCategoryGroup[] = [
    {
      id: "goals",
      name: "Goals",
      categories: [{ id: "cat-1", name: "Trip", emoji: "🏖️" }],
    },
  ];

  it("renames the matching category", () => {
    const next = syncSavingsCategory(groups, "cat-1", { name: "Spain Trip" });
    expect(next[0].categories[0].name).toBe("Spain Trip");
  });

  it("clears the emoji when set to an empty string", () => {
    const next = syncSavingsCategory(groups, "cat-1", { emoji: "" });
    expect(next[0].categories[0].emoji).toBeUndefined();
  });

  it("ignores categories that don't match", () => {
    const next = syncSavingsCategory(groups, "missing", { name: "Nope" });
    expect(next[0].categories[0].name).toBe("Trip");
  });
});

describe("removeSavingsCategoryFromGroups", () => {
  it("filters the matching category out of every group", () => {
    const groups: BudgetCategoryGroup[] = [
      {
        id: "goals",
        name: "Goals",
        categories: [
          { id: "keep", name: "Keep" },
          { id: "drop", name: "Drop" },
        ],
      },
    ];
    const next = removeSavingsCategoryFromGroups(groups, "drop");
    expect(next[0].categories.map((c) => c.id)).toEqual(["keep"]);
  });
});
