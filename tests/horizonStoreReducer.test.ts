// Coverage for the pure `coreReducer` powering HorizonStore. The
// provider wires React state around it, but every state transition the
// app makes is a function call away — these tests pin the cases that
// matter most: budget structure mutations, planner CRUD + cascades,
// duplicate, reorder, and the tombstoning that keeps cloud-merge from
// resurrecting deletes.

import { describe, expect, it } from "vitest";
import {
  coreReducer,
  type Action,
  type State,
} from "@/components/store/HorizonStore";
import type { Account } from "@/lib/accounts";
import type { Transaction } from "@/lib/transactions";
import type {
  PlannerBudget,
  PlannerEntry,
  PlannerFolder,
  FudgetRecurring,
} from "@/lib/planner";

function emptyState(overrides: Partial<State> = {}): State {
  return {
    transactions: [],
    accounts: [],
    groups: [],
    assignments: {},
    pinnedCategoryIds: [],
    targets: {},
    plannerFolders: [],
    plannerBudgets: [],
    plannerEntries: [],
    fudgetRecurring: [],
    scheduledTransactions: [],
    reconciliations: [],
    monthNotes: {},
    rules: [],
    wishlist: [],
    savingsGoals: [],
    templates: [],
    settings: { currency: "USD", theme: "dark" },
    tombstones: {},
    lastModifiedAt: 0,
    hydrated: false,
    ...overrides,
  };
}

function tx(partial: Partial<Transaction> = {}): Transaction {
  return {
    id: partial.id ?? "tx-" + Math.random().toString(36).slice(2, 8),
    date: partial.date ?? "2026-05-04",
    payee: partial.payee ?? "Test",
    category: partial.category ?? "Groceries",
    amount: partial.amount ?? 0,
    account: partial.account ?? "Checking",
    cleared: partial.cleared ?? true,
    isReadyToAssign: partial.isReadyToAssign,
    splits: partial.splits,
    transferId: partial.transferId,
    memo: partial.memo,
    tags: partial.tags,
  };
}

function acc(partial: Partial<Account> & { id: string; name: string }): Account {
  return {
    type: "checking",
    balance: 0,
    ...partial,
  };
}

// ─── Budget structure ───────────────────────────────────────────────────

describe("add_group / rename_group / delete_group", () => {
  it("appends a new group with an empty category list", () => {
    const before = emptyState();
    const after = coreReducer(before, { type: "add_group", name: "Debts" });
    expect(after.groups).toHaveLength(1);
    expect(after.groups[0].name).toBe("Debts");
    expect(after.groups[0].categories).toEqual([]);
    expect(after.groups[0].id).toBeTruthy();
  });

  it("renames only the matching group", () => {
    const before = emptyState({
      groups: [
        { id: "g1", name: "Bills", categories: [] },
        { id: "g2", name: "Frequent", categories: [] },
      ],
    });
    const after = coreReducer(before, {
      type: "rename_group",
      groupId: "g2",
      name: "Lifestyle",
    });
    expect(after.groups.map((g) => g.name)).toEqual(["Bills", "Lifestyle"]);
  });

  it("delete_group cascades to assignments, targets, pins, and tombstones", () => {
    const before = emptyState({
      groups: [
        {
          id: "g1",
          name: "Frequent",
          categories: [
            { id: "c1", name: "Groceries" },
            { id: "c2", name: "Gas" },
          ],
        },
      ],
      assignments: { "2026-05": { c1: 200, c2: 50 } },
      targets: {
        c1: { kind: "refill", amount: 200 },
        c2: { kind: "spending", amount: 100 },
      },
      pinnedCategoryIds: ["c1", "c2"],
    });
    const after = coreReducer(before, { type: "delete_group", groupId: "g1" });
    expect(after.groups).toEqual([]);
    // Assignments for deleted categories should be gone for this month.
    expect(after.assignments["2026-05"]?.c1).toBeUndefined();
    expect(after.assignments["2026-05"]?.c2).toBeUndefined();
    expect(after.targets).toEqual({});
    expect(after.pinnedCategoryIds).toEqual([]);
    expect(after.tombstones).toMatchObject({ g1: expect.any(Number) });
    expect(after.tombstones).toMatchObject({ c1: expect.any(Number) });
    expect(after.tombstones).toMatchObject({ c2: expect.any(Number) });
  });

  it("delete_group is a no-op for a missing groupId", () => {
    const before = emptyState({
      groups: [{ id: "g1", name: "Bills", categories: [] }],
    });
    const after = coreReducer(before, {
      type: "delete_group",
      groupId: "missing",
    });
    expect(after).toBe(before);
  });
});

describe("add_category / rename_category / delete_category", () => {
  const stateWith = () =>
    emptyState({
      groups: [
        {
          id: "g1",
          name: "Frequent",
          categories: [{ id: "c1", name: "Groceries" }],
        },
      ],
    });

  it("adds a category onto the matching group", () => {
    const after = coreReducer(stateWith(), {
      type: "add_category",
      groupId: "g1",
      name: "Gas",
      id: "c2",
    });
    expect(after.groups[0].categories).toEqual([
      { id: "c1", name: "Groceries" },
      { id: "c2", name: "Gas" },
    ]);
  });

  it("rename_category propagates to transactions and their splits", () => {
    const before = emptyState({
      groups: [
        {
          id: "g1",
          name: "Frequent",
          categories: [{ id: "c1", name: "Groceries" }],
        },
      ],
      transactions: [
        tx({ id: "t1", category: "Groceries", amount: -30 }),
        tx({
          id: "t2",
          category: "Split",
          splits: [
            { id: "s1", category: "Groceries", amount: -10 },
            { id: "s2", category: "Gas", amount: -20 },
          ],
        }),
        tx({ id: "t3", category: "Gas", amount: -25 }),
      ],
    });
    const after = coreReducer(before, {
      type: "rename_category",
      categoryId: "c1",
      name: "Food",
    });
    expect(after.groups[0].categories[0].name).toBe("Food");
    expect(after.transactions[0].category).toBe("Food");
    expect(after.transactions[1].splits?.[0].category).toBe("Food");
    expect(after.transactions[1].splits?.[1].category).toBe("Gas");
    expect(after.transactions[2].category).toBe("Gas");
  });

  it("delete_category prunes assignments/targets/pins and tombstones", () => {
    const before = emptyState({
      groups: [
        {
          id: "g1",
          name: "Frequent",
          categories: [
            { id: "c1", name: "Groceries" },
            { id: "c2", name: "Gas" },
          ],
        },
      ],
      assignments: { "2026-05": { c1: 100, c2: 50 } },
      targets: { c1: { kind: "refill", amount: 100 } },
      pinnedCategoryIds: ["c1", "c2"],
    });
    const after = coreReducer(before, {
      type: "delete_category",
      categoryId: "c1",
    });
    expect(after.groups[0].categories.map((c) => c.id)).toEqual(["c2"]);
    expect(after.assignments["2026-05"]?.c1).toBeUndefined();
    expect(after.assignments["2026-05"]?.c2).toBe(50);
    expect(after.targets).toEqual({});
    expect(after.pinnedCategoryIds).toEqual(["c2"]);
    expect(after.tombstones).toMatchObject({ c1: expect.any(Number) });
  });

  it("set_category_hidden flips both directions and strips the field on unhide", () => {
    const before = emptyState({
      groups: [
        {
          id: "g1",
          name: "X",
          categories: [{ id: "c1", name: "Groceries" }],
        },
      ],
    });
    const hidden = coreReducer(before, {
      type: "set_category_hidden",
      categoryId: "c1",
      hidden: true,
    });
    expect(hidden.groups[0].categories[0].hidden).toBe(true);
    const visible = coreReducer(hidden, {
      type: "set_category_hidden",
      categoryId: "c1",
      hidden: false,
    });
    // Field is removed entirely, not left as `false`, so serialized
    // payloads stay tidy.
    expect("hidden" in visible.groups[0].categories[0]).toBe(false);
  });

  it("set_category_emoji round-trips and clears on empty input", () => {
    const before = emptyState({
      groups: [
        {
          id: "g1",
          name: "X",
          categories: [{ id: "c1", name: "Groceries" }],
        },
      ],
    });
    const withEmoji = coreReducer(before, {
      type: "set_category_emoji",
      categoryId: "c1",
      emoji: "🛒",
    });
    expect(withEmoji.groups[0].categories[0].emoji).toBe("🛒");
    const cleared = coreReducer(withEmoji, {
      type: "set_category_emoji",
      categoryId: "c1",
      emoji: "   ",
    });
    expect("emoji" in cleared.groups[0].categories[0]).toBe(false);
  });
});

describe("set_assignment / toggle_pin / set_target", () => {
  it("set_assignment stores values per month/category", () => {
    const before = emptyState();
    const a = coreReducer(before, {
      type: "set_assignment",
      monthKey: "2026-05",
      categoryId: "c1",
      amount: 200,
    });
    expect(a.assignments["2026-05"]?.c1).toBe(200);
    const b = coreReducer(a, {
      type: "set_assignment",
      monthKey: "2026-05",
      categoryId: "c2",
      amount: 50,
    });
    expect(b.assignments["2026-05"]).toEqual({ c1: 200, c2: 50 });
  });

  it("toggle_pin adds then removes", () => {
    const before = emptyState();
    const pinned = coreReducer(before, { type: "toggle_pin", categoryId: "c1" });
    expect(pinned.pinnedCategoryIds).toEqual(["c1"]);
    const unpinned = coreReducer(pinned, {
      type: "toggle_pin",
      categoryId: "c1",
    });
    expect(unpinned.pinnedCategoryIds).toEqual([]);
  });

  it("set_target writes, replaces, and clears on null", () => {
    const before = emptyState();
    const set1 = coreReducer(before, {
      type: "set_target",
      categoryId: "c1",
      target: { kind: "refill", amount: 200 },
    });
    expect(set1.targets.c1).toEqual({ kind: "refill", amount: 200 });
    const set2 = coreReducer(set1, {
      type: "set_target",
      categoryId: "c1",
      target: { kind: "spending", amount: 50 },
    });
    expect(set2.targets.c1).toEqual({ kind: "spending", amount: 50 });
    const cleared = coreReducer(set2, {
      type: "set_target",
      categoryId: "c1",
      target: null,
    });
    expect(cleared.targets.c1).toBeUndefined();
  });
});

// ─── Reorder ───────────────────────────────────────────────────────────

describe("reorder_group / reorder_category / move_group / move_category", () => {
  const threeGroups = () =>
    emptyState({
      groups: [
        { id: "g1", name: "A", categories: [{ id: "c1", name: "x" }] },
        {
          id: "g2",
          name: "B",
          categories: [
            { id: "c2", name: "y" },
            { id: "c3", name: "z" },
          ],
        },
        { id: "g3", name: "C", categories: [{ id: "c4", name: "w" }] },
      ],
    });

  it("reorder_group respects targetIndex and clamps out-of-range values", () => {
    const after = coreReducer(threeGroups(), {
      type: "reorder_group",
      groupId: "g3",
      targetIndex: 0,
    });
    expect(after.groups.map((g) => g.id)).toEqual(["g3", "g1", "g2"]);
    const clamped = coreReducer(threeGroups(), {
      type: "reorder_group",
      groupId: "g1",
      targetIndex: 999,
    });
    expect(clamped.groups.map((g) => g.id)).toEqual(["g2", "g3", "g1"]);
  });

  it("reorder_category within the same group", () => {
    const after = coreReducer(threeGroups(), {
      type: "reorder_category",
      categoryId: "c3",
      targetIndex: 0,
    });
    expect(after.groups[1].categories.map((c) => c.id)).toEqual(["c3", "c2"]);
  });

  it("reorder_category across groups via destGroupId", () => {
    const after = coreReducer(threeGroups(), {
      type: "reorder_category",
      categoryId: "c2",
      destGroupId: "g1",
      targetIndex: 0,
    });
    expect(after.groups[0].categories.map((c) => c.id)).toEqual(["c2", "c1"]);
    expect(after.groups[1].categories.map((c) => c.id)).toEqual(["c3"]);
  });

  it("move_group swaps with neighbor; clamps at edges", () => {
    const after = coreReducer(threeGroups(), {
      type: "move_group",
      groupId: "g1",
      delta: 1,
    });
    expect(after.groups.map((g) => g.id)).toEqual(["g2", "g1", "g3"]);
    // Edge case: moving g1 up from index 0 is a no-op; the reducer
    // returns the same state reference so memoised selectors don't
    // re-fire.
    const edgeBefore = threeGroups();
    const edge = coreReducer(edgeBefore, {
      type: "move_group",
      groupId: "g1",
      delta: -1,
    });
    expect(edge).toBe(edgeBefore);
  });

  it("move_category stays in its owning group", () => {
    const after = coreReducer(threeGroups(), {
      type: "move_category",
      categoryId: "c2",
      delta: 1,
    });
    expect(after.groups[1].categories.map((c) => c.id)).toEqual(["c3", "c2"]);
  });
});

// ─── Transactions ──────────────────────────────────────────────────────

describe("transactions", () => {
  it("add_transaction prepends a new tx", () => {
    const before = emptyState({ transactions: [tx({ id: "old" })] });
    const after = coreReducer(before, {
      type: "add_transaction",
      tx: tx({ id: "new" }),
    });
    expect(after.transactions.map((t) => t.id)).toEqual(["new", "old"]);
  });

  it("update_transaction replaces by id", () => {
    const before = emptyState({
      transactions: [tx({ id: "t1", payee: "Old" })],
    });
    const after = coreReducer(before, {
      type: "update_transaction",
      tx: tx({ id: "t1", payee: "New" }),
    });
    expect(after.transactions[0].payee).toBe("New");
  });

  it("delete_transaction removes by id and tombstones", () => {
    const before = emptyState({
      transactions: [tx({ id: "t1" }), tx({ id: "t2" })],
    });
    const after = coreReducer(before, { type: "delete_transaction", id: "t1" });
    expect(after.transactions.map((t) => t.id)).toEqual(["t2"]);
    expect(after.tombstones).toMatchObject({ t1: expect.any(Number) });
  });

  it("rename_payee matches case-insensitively and updates all hits", () => {
    const before = emptyState({
      transactions: [
        tx({ id: "t1", payee: "kroger" }),
        tx({ id: "t2", payee: "KROGER" }),
        tx({ id: "t3", payee: "Trader Joe's" }),
      ],
    });
    const after = coreReducer(before, {
      type: "rename_payee",
      oldName: "Kroger",
      newName: "Kroger's",
    });
    expect(after.transactions.map((t) => t.payee)).toEqual([
      "Kroger's",
      "Kroger's",
      "Trader Joe's",
    ]);
  });

  it("rename_payee no-ops on empty newName", () => {
    const before = emptyState({
      transactions: [tx({ id: "t1", payee: "Kroger" })],
    });
    const after = coreReducer(before, {
      type: "rename_payee",
      oldName: "Kroger",
      newName: "",
    });
    expect(after).toBe(before);
  });
});

// ─── Planner: folders ──────────────────────────────────────────────────

describe("planner folder reducers", () => {
  const seed = (): State =>
    emptyState({
      plannerFolders: [{ id: "f1", name: "May 2026", order: 0 }],
      plannerBudgets: [
        { id: "b1", folderId: "f1", name: "Main", order: 0 },
        { id: "b2", folderId: "f1", name: "Side", order: 1 },
      ],
      plannerEntries: [
        {
          id: "e1",
          budgetId: "b1",
          label: "Rent",
          amount: -1000,
          date: "2026-05-01",
        },
        {
          id: "e2",
          budgetId: "b2",
          label: "Freelance",
          amount: 500,
          date: "2026-05-10",
        },
      ],
    });

  it("add_planner_folder appends; rename_planner_folder renames in place", () => {
    const added = coreReducer(emptyState(), {
      type: "add_planner_folder",
      folder: { id: "f1", name: "May 2026", order: 0 },
    });
    expect(added.plannerFolders).toHaveLength(1);
    const renamed = coreReducer(added, {
      type: "rename_planner_folder",
      folderId: "f1",
      name: "May (final)",
    });
    expect(renamed.plannerFolders[0].name).toBe("May (final)");
  });

  it("delete_planner_folder cascades to budgets, entries, and tombstones every id", () => {
    const after = coreReducer(seed(), {
      type: "delete_planner_folder",
      folderId: "f1",
    });
    expect(after.plannerFolders).toEqual([]);
    expect(after.plannerBudgets).toEqual([]);
    expect(after.plannerEntries).toEqual([]);
    expect(after.tombstones).toMatchObject({
      f1: expect.any(Number),
      b1: expect.any(Number),
      b2: expect.any(Number),
      e1: expect.any(Number),
      e2: expect.any(Number),
    });
  });

  it("delete_planner_folder leaves siblings in other folders alone", () => {
    const before = emptyState({
      plannerFolders: [
        { id: "f1", name: "May", order: 0 },
        { id: "f2", name: "June", order: 1 },
      ],
      plannerBudgets: [
        { id: "b1", folderId: "f1", name: "Main", order: 0 },
        { id: "b2", folderId: "f2", name: "Main", order: 0 },
      ],
      plannerEntries: [
        { id: "e1", budgetId: "b1", label: "x", amount: 1 },
        { id: "e2", budgetId: "b2", label: "y", amount: 2 },
      ],
    });
    const after = coreReducer(before, {
      type: "delete_planner_folder",
      folderId: "f1",
    });
    expect(after.plannerFolders.map((f) => f.id)).toEqual(["f2"]);
    expect(after.plannerBudgets.map((b) => b.id)).toEqual(["b2"]);
    expect(after.plannerEntries.map((e) => e.id)).toEqual(["e2"]);
  });

  it("duplicate_planner_folder clones every budget + entry under the new folder", () => {
    const newFolder: PlannerFolder = {
      id: "f1-copy",
      name: "May 2026 (copy)",
      order: 100,
    };
    const after = coreReducer(seed(), {
      type: "duplicate_planner_folder",
      folderId: "f1",
      newFolder,
      budgetIdMap: { b1: "b1-copy", b2: "b2-copy" },
      entryIdMap: { e1: "e1-copy", e2: "e2-copy" },
    });
    expect(after.plannerFolders.map((f) => f.id)).toEqual(["f1", "f1-copy"]);
    expect(after.plannerBudgets.map((b) => b.id).sort()).toEqual(
      ["b1", "b1-copy", "b2", "b2-copy"].sort(),
    );
    const copies = after.plannerBudgets.filter(
      (b) => b.folderId === "f1-copy",
    );
    expect(copies.map((b) => b.id).sort()).toEqual(["b1-copy", "b2-copy"]);
    expect(after.plannerEntries.map((e) => e.id).sort()).toEqual(
      ["e1", "e1-copy", "e2", "e2-copy"].sort(),
    );
    // Cloned entries point at the new budget ids.
    const clonedEntryByOrig = (origId: string) =>
      after.plannerEntries.find((e) => e.id === `${origId}-copy`);
    expect(clonedEntryByOrig("e1")?.budgetId).toBe("b1-copy");
    expect(clonedEntryByOrig("e2")?.budgetId).toBe("b2-copy");
  });
});

// ─── Planner: budgets ──────────────────────────────────────────────────

describe("planner budget reducers", () => {
  const seed = (): State =>
    emptyState({
      plannerFolders: [{ id: "f1", name: "May 2026", order: 0 }],
      plannerBudgets: [{ id: "b1", folderId: "f1", name: "Main", order: 0 }],
      plannerEntries: [
        { id: "e1", budgetId: "b1", label: "Rent", amount: -1000 },
        { id: "e2", budgetId: "b1", label: "Salary", amount: 3000 },
      ],
    });

  it("add_planner_budget appends; rename_planner_budget renames", () => {
    const added = coreReducer(seed(), {
      type: "add_planner_budget",
      budget: { id: "b2", folderId: "f1", name: "Side", order: 1 },
    });
    expect(added.plannerBudgets.map((b) => b.id)).toEqual(["b1", "b2"]);
    const renamed = coreReducer(added, {
      type: "rename_planner_budget",
      budgetId: "b2",
      name: "Side Hustle",
    });
    expect(renamed.plannerBudgets[1].name).toBe("Side Hustle");
  });

  it("delete_planner_budget removes the budget, its entries, and tombstones both", () => {
    const after = coreReducer(seed(), {
      type: "delete_planner_budget",
      budgetId: "b1",
    });
    expect(after.plannerBudgets).toEqual([]);
    expect(after.plannerEntries).toEqual([]);
    expect(after.tombstones).toMatchObject({
      b1: expect.any(Number),
      e1: expect.any(Number),
      e2: expect.any(Number),
    });
  });

  it("duplicate_planner_budget clones the budget and remaps entry ids", () => {
    const newBudget: PlannerBudget = {
      id: "b1-copy",
      folderId: "f1",
      name: "Main (copy)",
      order: 99,
    };
    const after = coreReducer(seed(), {
      type: "duplicate_planner_budget",
      budgetId: "b1",
      newBudget,
      idMap: { e1: "e1-copy", e2: "e2-copy" },
    });
    expect(after.plannerBudgets.map((b) => b.id)).toEqual(["b1", "b1-copy"]);
    expect(after.plannerEntries.map((e) => e.id).sort()).toEqual(
      ["e1", "e1-copy", "e2", "e2-copy"].sort(),
    );
    const copies = after.plannerEntries.filter(
      (e) => e.budgetId === "b1-copy",
    );
    expect(copies.map((e) => e.label).sort()).toEqual(["Rent", "Salary"]);
  });
});

// ─── Planner: entries ──────────────────────────────────────────────────

describe("planner entry reducers", () => {
  const seed = (): State =>
    emptyState({
      plannerBudgets: [{ id: "b1", folderId: "f1", name: "Main", order: 0 }],
      plannerEntries: [
        { id: "e1", budgetId: "b1", label: "Rent", amount: -1000, order: 0 },
        { id: "e2", budgetId: "b1", label: "Internet", amount: -80, order: 1 },
        { id: "e3", budgetId: "b1", label: "Salary", amount: 3000, order: 2 },
      ],
    });

  it("add_planner_entry prepends", () => {
    const after = coreReducer(seed(), {
      type: "add_planner_entry",
      entry: { id: "e4", budgetId: "b1", label: "Gas", amount: -40, order: 3 },
    });
    expect(after.plannerEntries[0].id).toBe("e4");
  });

  it("add_planner_entries with empty array is a no-op", () => {
    const before = seed();
    const after = coreReducer(before, {
      type: "add_planner_entries",
      entries: [],
    });
    expect(after).toBe(before);
  });

  it("update_planner_entry replaces by id", () => {
    const after = coreReducer(seed(), {
      type: "update_planner_entry",
      entry: {
        id: "e1",
        budgetId: "b1",
        label: "Rent (updated)",
        amount: -1100,
        order: 0,
      },
    });
    const updated = after.plannerEntries.find((e) => e.id === "e1");
    expect(updated?.label).toBe("Rent (updated)");
    expect(updated?.amount).toBe(-1100);
  });

  it("delete_planner_entry removes by id and tombstones", () => {
    const after = coreReducer(seed(), {
      type: "delete_planner_entry",
      id: "e2",
    });
    expect(after.plannerEntries.map((e) => e.id).sort()).toEqual(["e1", "e3"]);
    expect(after.tombstones).toMatchObject({ e2: expect.any(Number) });
  });

  it("set_planner_entry_paid toggles the paid flag", () => {
    const on = coreReducer(seed(), {
      type: "set_planner_entry_paid",
      id: "e1",
      paid: true,
    });
    expect(on.plannerEntries.find((e) => e.id === "e1")?.paid).toBe(true);
    const off = coreReducer(on, {
      type: "set_planner_entry_paid",
      id: "e1",
      paid: false,
    });
    expect(off.plannerEntries.find((e) => e.id === "e1")?.paid).toBe(false);
  });

  it("reorder_planner_entry within the same date keeps order monotonic", () => {
    const before = emptyState({
      plannerBudgets: [{ id: "b1", folderId: "f1", name: "Main" }],
      plannerEntries: [
        { id: "e1", budgetId: "b1", label: "A", amount: 1, date: "2026-05-01", order: 0 },
        { id: "e2", budgetId: "b1", label: "B", amount: 1, date: "2026-05-01", order: 1 },
        { id: "e3", budgetId: "b1", label: "C", amount: 1, date: "2026-05-01", order: 2 },
      ],
    });
    const after = coreReducer(before, {
      type: "reorder_planner_entry",
      sourceId: "e3",
      targetId: "e1",
      position: "before",
    });
    const sorted = after.plannerEntries
      .slice()
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    expect(sorted.map((e) => e.id)).toEqual(["e3", "e1", "e2"]);
  });

  it("reorder_planner_entry retags the source date when crossing date groups", () => {
    const before = emptyState({
      plannerBudgets: [{ id: "b1", folderId: "f1", name: "Main" }],
      plannerEntries: [
        { id: "e1", budgetId: "b1", label: "A", amount: 1, date: "2026-05-01", order: 0 },
        { id: "e2", budgetId: "b1", label: "B", amount: 1, date: "2026-05-15", order: 0 },
      ],
    });
    const after = coreReducer(before, {
      type: "reorder_planner_entry",
      sourceId: "e1",
      targetId: "e2",
      position: "after",
    });
    expect(after.plannerEntries.find((e) => e.id === "e1")?.date).toBe(
      "2026-05-15",
    );
  });

  it("reorder_planner_entry is a no-op across budgets", () => {
    const before = emptyState({
      plannerBudgets: [
        { id: "b1", folderId: "f1", name: "A" },
        { id: "b2", folderId: "f1", name: "B" },
      ],
      plannerEntries: [
        { id: "e1", budgetId: "b1", label: "x", amount: 1 },
        { id: "e2", budgetId: "b2", label: "y", amount: 1 },
      ],
    });
    const after = coreReducer(before, {
      type: "reorder_planner_entry",
      sourceId: "e1",
      targetId: "e2",
      position: "after",
    });
    expect(after).toBe(before);
  });
});

// ─── Fudget recurring ──────────────────────────────────────────────────

describe("fudget recurring reducers", () => {
  const seed = () =>
    emptyState({
      fudgetRecurring: [
        { id: "r1", label: "Rent", amount: -1000, dayOfMonth: 1 },
      ] satisfies FudgetRecurring[],
    });

  it("add_fudget_recurring appends", () => {
    const after = coreReducer(seed(), {
      type: "add_fudget_recurring",
      item: { id: "r2", label: "Netflix", amount: -15 },
    });
    expect(after.fudgetRecurring.map((r) => r.id)).toEqual(["r1", "r2"]);
  });

  it("update_fudget_recurring replaces by id", () => {
    const after = coreReducer(seed(), {
      type: "update_fudget_recurring",
      item: { id: "r1", label: "Rent", amount: -1100, dayOfMonth: 1 },
    });
    expect(after.fudgetRecurring[0].amount).toBe(-1100);
  });

  it("delete_fudget_recurring removes + tombstones", () => {
    const after = coreReducer(seed(), {
      type: "delete_fudget_recurring",
      id: "r1",
    });
    expect(after.fudgetRecurring).toEqual([]);
    expect(after.tombstones).toMatchObject({ r1: expect.any(Number) });
  });
});

// ─── Accounts ──────────────────────────────────────────────────────────

describe("account reducers", () => {
  it("set_account_closed flips the closed flag (and strips on reopen)", () => {
    const before = emptyState({
      accounts: [acc({ id: "a1", name: "Checking" })],
    });
    const closed = coreReducer(before, {
      type: "set_account_closed",
      accountId: "a1",
      closed: true,
    });
    expect(closed.accounts[0].closed).toBe(true);
    const open = coreReducer(closed, {
      type: "set_account_closed",
      accountId: "a1",
      closed: false,
    });
    // Reducer drops the field rather than persisting `closed: false`, so
    // serialised payloads stay tidy — mirrors set_category_hidden.
    expect("closed" in open.accounts[0]).toBe(false);
  });

  it("set_account_note trims and clears empty notes", () => {
    const before = emptyState({
      accounts: [acc({ id: "a1", name: "Checking" })],
    });
    const set = coreReducer(before, {
      type: "set_account_note",
      accountId: "a1",
      note: "  hello world  ",
    });
    expect(set.accounts[0].note).toBe("hello world");
    const cleared = coreReducer(set, {
      type: "set_account_note",
      accountId: "a1",
      note: "  ",
    });
    expect("note" in cleared.accounts[0]).toBe(false);
  });

  it("set_account_photo writes both url + storagePath; null clears both", () => {
    const before = emptyState({
      accounts: [acc({ id: "a1", name: "Checking" })],
    });
    const set = coreReducer(before, {
      type: "set_account_photo",
      accountId: "a1",
      photo: "https://storage/x.jpg",
      storagePath: "users/u/x.jpg",
    });
    expect(set.accounts[0].photoDataUrl).toBe("https://storage/x.jpg");
    expect(set.accounts[0].photoStoragePath).toBe("users/u/x.jpg");
    const cleared = coreReducer(set, {
      type: "set_account_photo",
      accountId: "a1",
      photo: null,
      storagePath: null,
    });
    expect("photoDataUrl" in cleared.accounts[0]).toBe(false);
    expect("photoStoragePath" in cleared.accounts[0]).toBe(false);
  });

  it("set_account_photo with no storagePath leaves an inline-only value", () => {
    const before = emptyState({
      accounts: [acc({ id: "a1", name: "Checking" })],
    });
    const set = coreReducer(before, {
      type: "set_account_photo",
      accountId: "a1",
      photo: "data:image/png;base64,xxx",
      storagePath: null,
    });
    expect(set.accounts[0].photoDataUrl).toBe("data:image/png;base64,xxx");
    expect("photoStoragePath" in set.accounts[0]).toBe(false);
  });

  it("set_account_debt_terms writes valid fields, ignores invalid ones, and clears nulls", () => {
    const before = emptyState({
      accounts: [acc({ id: "a1", name: "Card", type: "credit-card" })],
    });
    const set = coreReducer(before, {
      type: "set_account_debt_terms",
      accountId: "a1",
      apr: 18.5,
      minimumPayment: 35,
      paymentDueDayOfMonth: 15,
      defaultFundingAccountId: "checking",
      accountNumber: "  4111111111111111  ",
      creditLimit: 5000,
    });
    const a = set.accounts[0];
    expect(a.apr).toBe(18.5);
    expect(a.minimumPayment).toBe(35);
    expect(a.paymentDueDayOfMonth).toBe(15);
    expect(a.defaultFundingAccountId).toBe("checking");
    expect(a.accountNumber).toBe("4111111111111111");
    expect(a.creditLimit).toBe(5000);

    // Invalid day-of-month gets dropped, not coerced.
    const bad = coreReducer(set, {
      type: "set_account_debt_terms",
      accountId: "a1",
      apr: 18.5,
      minimumPayment: 35,
      paymentDueDayOfMonth: 99,
      defaultFundingAccountId: "checking",
      accountNumber: "4111111111111111",
      creditLimit: 5000,
    });
    expect("paymentDueDayOfMonth" in bad.accounts[0]).toBe(false);

    // Nulls clear individual fields without touching the others.
    const partial = coreReducer(set, {
      type: "set_account_debt_terms",
      accountId: "a1",
      apr: null,
      minimumPayment: 35,
      paymentDueDayOfMonth: 15,
      defaultFundingAccountId: null,
      accountNumber: null,
      creditLimit: null,
    });
    expect("apr" in partial.accounts[0]).toBe(false);
    expect("defaultFundingAccountId" in partial.accounts[0]).toBe(false);
    expect("accountNumber" in partial.accounts[0]).toBe(false);
    expect("creditLimit" in partial.accounts[0]).toBe(false);
    expect(partial.accounts[0].minimumPayment).toBe(35);
    expect(partial.accounts[0].paymentDueDayOfMonth).toBe(15);
  });

  it("set_account_debt_terms with zero/negative credit limit drops the field", () => {
    const before = emptyState({
      accounts: [acc({ id: "a1", name: "Card", type: "credit-card" })],
    });
    const zero = coreReducer(before, {
      type: "set_account_debt_terms",
      accountId: "a1",
      apr: null,
      minimumPayment: null,
      paymentDueDayOfMonth: null,
      defaultFundingAccountId: null,
      accountNumber: null,
      creditLimit: 0,
    });
    expect("creditLimit" in zero.accounts[0]).toBe(false);
  });
});

// ─── Misc ──────────────────────────────────────────────────────────────

describe("settings / notes / restore", () => {
  it("set_settings replaces the settings object", () => {
    const before = emptyState();
    const after = coreReducer(before, {
      type: "set_settings",
      settings: { currency: "EUR", theme: "pipboy" },
    });
    expect(after.settings).toEqual({ currency: "EUR", theme: "pipboy" });
  });

  it("set_month_note writes per month", () => {
    const before = emptyState();
    const after = coreReducer(before, {
      type: "set_month_note",
      monthKey: "2026-05",
      note: "Hold spending until the 15th",
    });
    expect(after.monthNotes["2026-05"]).toBe("Hold spending until the 15th");
  });

  it("restore merges payload arrays in, leaving missing fields as state defaults", () => {
    const before = emptyState({
      transactions: [tx({ id: "old" })],
      groups: [{ id: "g1", name: "X", categories: [] }],
    });
    const after = coreReducer(before, {
      type: "restore",
      payload: {
        transactions: [tx({ id: "new" })],
        // groups intentionally omitted → preserved
      },
    });
    expect(after.transactions.map((t) => t.id)).toEqual(["new"]);
    expect(after.groups.map((g) => g.id)).toEqual(["g1"]);
  });
});

describe("rules", () => {
  const rule = (id: string, payee: string) => ({
    id,
    pattern: payee,
    category: "Groceries",
    enabled: true,
  });

  it("add_rule / update_rule / delete_rule", () => {
    const r1 = rule("r1", "kroger");
    const r2 = rule("r2", "amzn");
    const added = coreReducer(emptyState(), { type: "add_rule", rule: r1 });
    expect(added.rules).toEqual([r1]);
    const both = coreReducer(added, { type: "add_rule", rule: r2 });
    expect(both.rules.map((r) => r.id)).toEqual(["r1", "r2"]);
    const updated = coreReducer(both, {
      type: "update_rule",
      rule: { ...r1, pattern: "kroger's" },
    });
    expect(updated.rules.find((r) => r.id === "r1")?.pattern).toBe("kroger's");
    const removed = coreReducer(updated, { type: "delete_rule", ruleId: "r1" });
    expect(removed.rules.map((r) => r.id)).toEqual(["r2"]);
    expect(removed.tombstones).toMatchObject({ r1: expect.any(Number) });
  });

  it("reorder_rules reorders by id list", () => {
    const r1 = rule("r1", "a");
    const r2 = rule("r2", "b");
    const r3 = rule("r3", "c");
    const before = emptyState({ rules: [r1, r2, r3] });
    const after = coreReducer(before, {
      type: "reorder_rules",
      ruleIds: ["r3", "r1", "r2"],
    });
    expect(after.rules.map((r) => r.id)).toEqual(["r3", "r1", "r2"]);
  });
});
