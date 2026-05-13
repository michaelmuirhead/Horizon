// Mirror layer between Bill accounts and the Budget tab. Each bill
// gets a paired category in the dedicated "Bills" group so the user
// can assign money to it from Budget. The bill's minimumPayment +
// paymentDueDayOfMonth feed a refill target on that category;
// minimumPayment alone is enough to attach the target, due day is
// surfaced separately by the UI.
//
// Pattern mirrors lib/savingsGoals.ts (ensureGoalsGroupHasCategory /
// removeSavingsCategoryFromGroups) so the two auto-mirror flows
// behave consistently. The rename cascade for a Bill happens inline
// inside the rename_account reducer case rather than via a dedicated
// helper — there's only one call site so the extra abstraction
// wasn't paying for itself.

import type {
  BudgetCategory,
  BudgetCategoryGroup,
  CategoryTarget,
} from "./budget";
import { BILLS_GROUP_ID, BILLS_GROUP_NAME } from "./accounts";

// Ensures the Bills group exists in the supplied groups array and
// returns the updated array with `category` appended to it. Matches
// by stable id first, then by case-insensitive name so a manually
// renamed Bills group isn't duplicated.
export function ensureBillsGroupHasCategory(
  groups: BudgetCategoryGroup[],
  category: BudgetCategory,
): BudgetCategoryGroup[] {
  const idx = groups.findIndex(
    (g) =>
      g.id === BILLS_GROUP_ID ||
      g.name.toLowerCase() === BILLS_GROUP_NAME.toLowerCase(),
  );
  if (idx < 0) {
    return [
      ...groups,
      {
        id: BILLS_GROUP_ID,
        name: BILLS_GROUP_NAME,
        categories: [category],
      },
    ];
  }
  return groups.map((g, i) =>
    i === idx ? { ...g, categories: [...g.categories, category] } : g,
  );
}

// Remove the mirrored category from every group. Used when a Bill
// account is deleted.
export function removeBillCategoryFromGroups(
  groups: BudgetCategoryGroup[],
  categoryId: string,
): BudgetCategoryGroup[] {
  return groups.map((g) => ({
    ...g,
    categories: g.categories.filter((c) => c.id !== categoryId),
  }));
}

// Build the target that should attach to a bill's mirrored category.
// Returns null when there's nothing meaningful to set (no
// minimumPayment yet). Refill semantics match the user's mental
// model: "each month, fund this category up to the bill amount."
export function targetForBill(account: {
  minimumPayment?: number;
}): CategoryTarget | null {
  if (
    typeof account.minimumPayment !== "number" ||
    !Number.isFinite(account.minimumPayment) ||
    account.minimumPayment <= 0
  ) {
    return null;
  }
  return { kind: "refill", amount: account.minimumPayment };
}
