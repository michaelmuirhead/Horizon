"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useState,
  type ReactNode,
} from "react";
import {
  type Transaction,
  sampleTransactions,
} from "@/lib/transactions";
import {
  type Account,
  type InvestmentValuation,
  type Reconciliation,
  ASSET_ACCOUNT_TYPES,
  CC_PAYMENTS_GROUP_NAME,
  liveAccountBalance,
  sampleAccounts,
} from "@/lib/accounts";
import {
  type Assignments,
  type BudgetCategory,
  type BudgetCategoryGroup,
  type CategoryTarget,
  type CategoryTargets,
  READY_TO_ASSIGN_CATEGORY,
  ccPaymentRouting,
  getAssigned,
  monthlyNeedForCategory,
  sampleAssignments,
  sampleBudget,
  setAssigned,
} from "@/lib/budget";
import { applyRules, type CategorizationRule } from "@/lib/categorization";
import {
  createHousehold,
  joinHousehold,
  leaveHousehold,
  resolveJoinCode,
} from "@/lib/cloudSync";
import { setCurrency as setCurrencyFormatter } from "@/lib/format";
import {
  type PlannerEntry,
  type PlannerFolder,
  type PlannerBudget,
  samplePlannerEntries,
  samplePlannerFolders,
  samplePlannerBudgets,
} from "@/lib/planner";
import { type WishlistItem, sampleWishlist } from "@/lib/wishlist";
import {
  type SavingsContribution,
  type SavingsGoal,
  ensureGoalsGroupHasCategory,
  removeSavingsCategoryFromGroups,
  sampleSavingsGoals,
  syncSavingsCategory,
  targetForSavingsGoal,
} from "@/lib/savingsGoals";
import { type TransactionTemplate, sampleTemplates } from "@/lib/templates";
import {
  advanceDate,
  todayIso as todayIsoScheduled,
  type ScheduledTransaction,
  samplePlannerScheduled,
} from "@/lib/scheduled";

// Distributive Omit so each arm of ScheduledTransaction keeps its required
// fields after id is dropped — addScheduled accepts either kind.
type ScheduledDistOmit<T, K extends keyof any> = T extends unknown
  ? Omit<T, K>
  : never;
type ScheduledInput = ScheduledDistOmit<ScheduledTransaction, "id">;

// Pre-multi-budget storage key. Read once on first launch to migrate into
// the new per-budget layout; never written after that.
const LEGACY_STORAGE_KEY = "horizon-store-v4";

// Budgets registry — what budgets exist and which one is active. Per-budget
// state lives at horizon-budget-<id>.
const BUDGETS_INDEX_KEY = "horizon-budgets-index-v1";
const DEFAULT_BUDGET_ID = "default";
const DEFAULT_BUDGET_NAME = "Personal";

export type BudgetMeta = {
  id: string;
  name: string;
  // When set, this local budget points at a Firestore household — Cloud
  // Sync writes to households/{householdId}/budget/state instead of the
  // per-user path. Membership is enforced by the household doc's
  // memberUids; the joinCode is the invite token to share with others.
  householdId?: string;
  joinCode?: string;
};

type BudgetsIndex = {
  currentBudgetId: string;
  budgets: BudgetMeta[];
};

function storageKeyFor(budgetId: string): string {
  return `horizon-budget-${budgetId}`;
}

function readBudgetsIndex(): BudgetsIndex | null {
  try {
    const raw = localStorage.getItem(BUDGETS_INDEX_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      !parsed ||
      typeof parsed.currentBudgetId !== "string" ||
      !Array.isArray(parsed.budgets)
    )
      return null;
    return parsed as BudgetsIndex;
  } catch {
    return null;
  }
}

function writeBudgetsIndex(index: BudgetsIndex): void {
  try {
    localStorage.setItem(BUDGETS_INDEX_KEY, JSON.stringify(index));
  } catch {
    // ignore
  }
}

export type ThemeName = "dark" | "light" | "pokemon" | "auto";

export type AppSettings = {
  currency: string;
  theme?: ThemeName;
  onboardingCompleted?: boolean;
  notificationsEnabled?: boolean;
};

const defaultSettings: AppSettings = { currency: "USD", theme: "dark" };

// Apply categorization rules at the moment a transaction enters the store
// (manual add and CSV import). Only rewrite when category is the
// "Uncategorized" default — explicit user picks always win.
function autoCategorize(
  tx: Transaction,
  rules: CategorizationRule[],
): Transaction {
  if (rules.length === 0) return tx;
  if (tx.isReadyToAssign) return tx;
  if (tx.transferId) return tx;
  if (tx.splits && tx.splits.length > 0) return tx;
  if (tx.category && tx.category !== "Uncategorized") return tx;
  const matched = applyRules(tx.payee, rules);
  if (!matched) return tx;
  return { ...tx, category: matched };
}

type State = {
  transactions: Transaction[];
  accounts: Account[];
  groups: BudgetCategoryGroup[];
  assignments: Assignments;
  pinnedCategoryIds: string[];
  targets: CategoryTargets;
  plannerFolders: PlannerFolder[];
  plannerBudgets: PlannerBudget[];
  plannerEntries: PlannerEntry[];
  scheduledTransactions: ScheduledTransaction[];
  reconciliations: Reconciliation[];
  monthNotes: Record<string, string>;
  rules: CategorizationRule[];
  wishlist: WishlistItem[];
  savingsGoals: SavingsGoal[];
  templates: TransactionTemplate[];
  settings: AppSettings;
  hydrated: boolean;
};

type Action =
  | {
      type: "hydrate";
      transactions: Transaction[];
      accounts: Account[];
      groups: BudgetCategoryGroup[];
      assignments: Assignments;
      pinnedCategoryIds: string[];
      targets: CategoryTargets;
      plannerFolders: PlannerFolder[];
      plannerBudgets: PlannerBudget[];
      plannerEntries: PlannerEntry[];
      scheduledTransactions: ScheduledTransaction[];
      reconciliations: Reconciliation[];
      monthNotes: Record<string, string>;
      rules: CategorizationRule[];
      wishlist: WishlistItem[];
      savingsGoals: SavingsGoal[];
      templates: TransactionTemplate[];
      settings: AppSettings;
    }
  | { type: "add_transaction"; tx: Transaction }
  | { type: "add_transactions"; txs: Transaction[] }
  | { type: "update_transaction"; tx: Transaction }
  | { type: "delete_transaction"; id: string }
  | { type: "rename_payee"; oldName: string; newName: string }
  | {
      type: "add_transfer";
      date: string;
      fromAccount: string;
      toAccount: string;
      amount: number;
      cleared: boolean;
      memo?: string;
    }
  | { type: "delete_transfer"; transferId: string }
  | {
      type: "update_transfer";
      transferId: string;
      date: string;
      memo: string | undefined;
      cleared: boolean;
    }
  | { type: "add_account"; account: Account }
  | { type: "rename_account"; accountId: string; name: string }
  | { type: "set_account_closed"; accountId: string; closed: boolean }
  | {
      type: "add_investment_valuation";
      accountId: string;
      valuation: InvestmentValuation;
    }
  | { type: "delete_investment_valuation"; accountId: string; valuationId: string }
  | { type: "delete_account"; accountId: string }
  | { type: "reconcile_account"; accountName: string; date: string }
  | {
      type: "add_reconciliation";
      reconciliation: Reconciliation;
    }
  | { type: "set_month_note"; monthKey: string; note: string }
  | { type: "add_rule"; rule: CategorizationRule }
  | { type: "update_rule"; rule: CategorizationRule }
  | { type: "delete_rule"; ruleId: string }
  | { type: "reorder_rules"; ruleIds: string[] }
  | { type: "add_wishlist_item"; item: WishlistItem }
  | { type: "update_wishlist_item"; item: WishlistItem }
  | { type: "delete_wishlist_item"; id: string }
  | { type: "add_savings_goal"; goal: SavingsGoal }
  | {
      type: "update_savings_goal";
      id: string;
      patch: Partial<
        Omit<
          SavingsGoal,
          "id" | "contributions" | "createdAt" | "categoryId"
        >
      >;
    }
  | { type: "delete_savings_goal"; id: string }
  | {
      type: "add_savings_contribution";
      goalId: string;
      contribution: SavingsContribution;
    }
  | {
      type: "delete_savings_contribution";
      goalId: string;
      contributionId: string;
    }
  | { type: "add_template"; template: TransactionTemplate }
  | { type: "update_template"; template: TransactionTemplate }
  | { type: "delete_template"; id: string }
  | {
      type: "set_assignment";
      monthKey: string;
      categoryId: string;
      amount: number;
    }
  | { type: "toggle_pin"; categoryId: string }
  | { type: "set_target"; categoryId: string; target: CategoryTarget | null }
  | { type: "add_group"; name: string }
  | { type: "rename_group"; groupId: string; name: string }
  | { type: "delete_group"; groupId: string }
  | { type: "add_category"; groupId: string; name: string }
  | { type: "rename_category"; categoryId: string; name: string }
  | { type: "set_category_note"; categoryId: string; note: string }
  | { type: "set_category_hidden"; categoryId: string; hidden: boolean }
  | { type: "set_category_emoji"; categoryId: string; emoji: string }
  | { type: "set_group_emoji"; groupId: string; emoji: string }
  | { type: "delete_category"; categoryId: string }
  | { type: "move_group"; groupId: string; delta: -1 | 1 }
  | { type: "move_category"; categoryId: string; delta: -1 | 1 }
  | { type: "reorder_group"; groupId: string; targetIndex: number }
  | { type: "reorder_category"; categoryId: string; targetIndex: number }
  | { type: "set_account_note"; accountId: string; note: string }
  | {
      type: "set_account_debt_terms";
      accountId: string;
      apr: number | null;
      minimumPayment: number | null;
    }
  | { type: "add_planner_folder"; folder: PlannerFolder }
  | { type: "rename_planner_folder"; id: string; name: string }
  | { type: "delete_planner_folder"; id: string }
  | { type: "duplicate_planner_folder"; sourceId: string; newId: string }
  | { type: "add_planner_budget"; budget: PlannerBudget }
  | { type: "rename_planner_budget"; id: string; name: string }
  | { type: "delete_planner_budget"; id: string }
  | {
      type: "duplicate_planner_budget";
      sourceId: string;
      newId: string;
      // Where the duplicate lands. Same folder by default; the menu lets
      // a user copy a budget into another folder too.
      folderId?: string;
    }
  | { type: "add_planner_entry"; entry: PlannerEntry }
  | { type: "update_planner_entry"; entry: PlannerEntry }
  | { type: "delete_planner_entry"; id: string }
  | { type: "set_planner_entry_paid"; id: string; paid: boolean }
  | {
      type: "reorder_planner_entry";
      id: string;
      targetId: string;
      // "after" lets the drag UI drop a row past the last entry of a
      // budget by pinning the action to the trailing edge of `targetId`
      // instead of immediately before it.
      position: "before" | "after";
    }
  | { type: "add_scheduled"; scheduled: ScheduledTransaction }
  | { type: "update_scheduled"; scheduled: ScheduledTransaction }
  | { type: "delete_scheduled"; id: string }
  | { type: "post_due_scheduled"; today: string }
  | { type: "auto_fund_recurring_targets"; monthKey: string }
  | { type: "set_settings"; settings: AppSettings }
  | { type: "restore"; payload: Partial<State> };

const initialState: State = {
  transactions: sampleTransactions,
  accounts: sampleAccounts,
  groups: sampleBudget,
  assignments: sampleAssignments,
  pinnedCategoryIds: [],
  targets: {},
  plannerFolders: samplePlannerFolders,
  plannerBudgets: samplePlannerBudgets,
  plannerEntries: samplePlannerEntries,
  scheduledTransactions: samplePlannerScheduled,
  reconciliations: [],
  monthNotes: {},
  rules: [],
  wishlist: sampleWishlist,
  savingsGoals: sampleSavingsGoals,
  templates: sampleTemplates,
  settings: defaultSettings,
  hydrated: false,
};

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "hydrate":
      return {
        transactions: action.transactions,
        accounts: action.accounts,
        groups: action.groups,
        assignments: action.assignments,
        pinnedCategoryIds: action.pinnedCategoryIds,
        targets: action.targets,
        plannerFolders: action.plannerFolders,
        plannerBudgets: action.plannerBudgets,
        plannerEntries: action.plannerEntries,
        scheduledTransactions: action.scheduledTransactions,
        reconciliations: action.reconciliations,
        monthNotes: action.monthNotes,
        rules: action.rules,
        wishlist: action.wishlist,
        savingsGoals: action.savingsGoals,
        templates: action.templates,
        settings: action.settings,
        hydrated: true,
      };
    case "add_transaction":
      return {
        ...state,
        transactions: [autoCategorize(action.tx, state.rules), ...state.transactions],
      };
    case "add_transactions":
      if (action.txs.length === 0) return state;
      return {
        ...state,
        transactions: [
          ...action.txs.map((tx) => autoCategorize(tx, state.rules)),
          ...state.transactions,
        ],
      };
    case "update_transaction":
      return {
        ...state,
        transactions: state.transactions.map((t) =>
          t.id === action.tx.id ? action.tx : t,
        ),
      };
    case "delete_transaction":
      return {
        ...state,
        transactions: state.transactions.filter((t) => t.id !== action.id),
      };
    case "rename_payee": {
      const needle = action.oldName.toLowerCase();
      if (action.newName === "") return state;
      return {
        ...state,
        transactions: state.transactions.map((t) =>
          t.payee.toLowerCase() === needle
            ? { ...t, payee: action.newName }
            : t,
        ),
      };
    }
    case "add_transfer": {
      const transferId = makeId();
      const fromTx: Transaction = {
        id: makeId(),
        date: action.date,
        payee: `Transfer to ${action.toAccount}`,
        category: "Transfer",
        amount: -action.amount,
        account: action.fromAccount,
        cleared: action.cleared,
        memo: action.memo,
        transferId,
      };
      const toTx: Transaction = {
        id: makeId(),
        date: action.date,
        payee: `Transfer from ${action.fromAccount}`,
        category: "Transfer",
        amount: action.amount,
        account: action.toAccount,
        cleared: action.cleared,
        memo: action.memo,
        transferId,
      };
      return {
        ...state,
        transactions: [fromTx, toTx, ...state.transactions],
      };
    }
    case "delete_transfer":
      return {
        ...state,
        transactions: state.transactions.filter(
          (t) => t.transferId !== action.transferId,
        ),
      };
    case "update_transfer":
      return {
        ...state,
        transactions: state.transactions.map((t) =>
          t.transferId === action.transferId
            ? {
                ...t,
                date: action.date,
                memo: action.memo,
                cleared: action.cleared,
              }
            : t,
        ),
      };
    case "add_account": {
      // Plain non-credit-card add: just push.
      if (action.account.type !== "credit-card") {
        return { ...state, accounts: [...state.accounts, action.account] };
      }

      // Credit-card add: also auto-create a paired payment category in a
      // shared "Credit Card Payments" group (creating the group if needed)
      // and link the account to the new category by id.
      const ccGroupIndex = state.groups.findIndex(
        (g) => g.name === CC_PAYMENTS_GROUP_NAME,
      );
      const newCategoryId = makeId();
      const newCategory = { id: newCategoryId, name: action.account.name };

      let nextGroups: BudgetCategoryGroup[];
      if (ccGroupIndex < 0) {
        nextGroups = [
          ...state.groups,
          {
            id: makeId(),
            name: CC_PAYMENTS_GROUP_NAME,
            categories: [newCategory],
          },
        ];
      } else {
        nextGroups = state.groups.map((g, i) =>
          i === ccGroupIndex
            ? { ...g, categories: [...g.categories, newCategory] }
            : g,
        );
      }

      return {
        ...state,
        accounts: [
          ...state.accounts,
          { ...action.account, ccPaymentCategoryId: newCategoryId },
        ],
        groups: nextGroups,
      };
    }
    case "rename_account": {
      const existing = state.accounts.find((a) => a.id === action.accountId);
      if (!existing) return state;
      const oldName = existing.name;
      const ccCatId = existing.ccPaymentCategoryId;
      return {
        ...state,
        accounts: state.accounts.map((a) =>
          a.id === action.accountId ? { ...a, name: action.name } : a,
        ),
        // Keep transactions tagged with the new name (they reference by name).
        transactions:
          oldName === action.name
            ? state.transactions
            : state.transactions.map((t) => {
                let next: Transaction | null = null;
                if (t.account === oldName) next = { ...t, account: action.name };
                if (t.payee === `Transfer to ${oldName}`)
                  next = { ...(next ?? t), payee: `Transfer to ${action.name}` };
                if (t.payee === `Transfer from ${oldName}`)
                  next = {
                    ...(next ?? t),
                    payee: `Transfer from ${action.name}`,
                  };
                return next ?? t;
              }),
        // Keep the paired CC payment category labelled with the new card name.
        groups:
          ccCatId && oldName !== action.name
            ? state.groups.map((g) => ({
                ...g,
                categories: g.categories.map((c) =>
                  c.id === ccCatId ? { ...c, name: action.name } : c,
                ),
              }))
            : state.groups,
      };
    }
    case "set_account_closed":
      return {
        ...state,
        accounts: state.accounts.map((a) => {
          if (a.id !== action.accountId) return a;
          if (!action.closed) {
            const { closed: _drop, ...rest } = a;
            void _drop;
            return rest;
          }
          return { ...a, closed: true };
        }),
      };
    case "add_investment_valuation":
      return {
        ...state,
        accounts: state.accounts.map((a) =>
          a.id === action.accountId
            ? {
                ...a,
                investmentValuations: [
                  ...(a.investmentValuations ?? []),
                  action.valuation,
                ],
              }
            : a,
        ),
      };
    case "delete_investment_valuation":
      return {
        ...state,
        accounts: state.accounts.map((a) =>
          a.id === action.accountId
            ? {
                ...a,
                investmentValuations: (a.investmentValuations ?? []).filter(
                  (v) => v.id !== action.valuationId,
                ),
              }
            : a,
        ),
      };
    case "delete_account":
      return {
        ...state,
        accounts: state.accounts.filter((a) => a.id !== action.accountId),
      };
    case "reconcile_account":
      return {
        ...state,
        transactions: state.transactions.map((t) =>
          t.account === action.accountName &&
          t.cleared &&
          !t.reconciled &&
          t.date <= action.date
            ? { ...t, reconciled: true }
            : t,
        ),
      };
    case "add_reconciliation":
      return {
        ...state,
        reconciliations: [action.reconciliation, ...state.reconciliations],
      };
    case "set_month_note": {
      const note = action.note.trim();
      const next = { ...state.monthNotes };
      if (note === "") delete next[action.monthKey];
      else next[action.monthKey] = note;
      return { ...state, monthNotes: next };
    }
    case "add_rule":
      return { ...state, rules: [...state.rules, action.rule] };
    case "update_rule":
      return {
        ...state,
        rules: state.rules.map((r) =>
          r.id === action.rule.id ? action.rule : r,
        ),
      };
    case "delete_rule":
      return {
        ...state,
        rules: state.rules.filter((r) => r.id !== action.ruleId),
      };
    case "reorder_rules": {
      const byId = new Map(state.rules.map((r) => [r.id, r]));
      const reordered: CategorizationRule[] = [];
      for (const id of action.ruleIds) {
        const r = byId.get(id);
        if (r) {
          reordered.push(r);
          byId.delete(id);
        }
      }
      // Anything not in the requested order keeps its tail position so we
      // never silently drop a rule on a stale reorder payload.
      for (const r of byId.values()) reordered.push(r);
      return { ...state, rules: reordered };
    }
    case "add_wishlist_item":
      return { ...state, wishlist: [action.item, ...state.wishlist] };
    case "update_wishlist_item":
      return {
        ...state,
        wishlist: state.wishlist.map((w) =>
          w.id === action.item.id ? action.item : w,
        ),
      };
    case "delete_wishlist_item":
      return {
        ...state,
        wishlist: state.wishlist.filter((w) => w.id !== action.id),
      };
    case "add_savings_goal": {
      // Mirror the goal into a fresh budget category in the "Goals" group
      // so the user can assign money to it from the Budget tab. The
      // category id matches what we stamp onto the goal so the two stay
      // findable from each other.
      const categoryId = action.goal.categoryId ?? makeId();
      const category: BudgetCategory = {
        id: categoryId,
        name: action.goal.name,
        ...(action.goal.emoji ? { emoji: action.goal.emoji } : {}),
      };
      const groups = ensureGoalsGroupHasCategory(state.groups, category);
      const target = targetForSavingsGoal(action.goal);
      const targets = target
        ? { ...state.targets, [categoryId]: target }
        : state.targets;
      return {
        ...state,
        savingsGoals: [
          { ...action.goal, categoryId },
          ...state.savingsGoals,
        ],
        groups,
        targets,
      };
    }
    case "update_savings_goal": {
      const existing = state.savingsGoals.find((g) => g.id === action.id);
      if (!existing) return state;
      const next: SavingsGoal = { ...existing, ...action.patch };
      const categoryId = existing.categoryId;
      const savingsGoals = state.savingsGoals.map((g) =>
        g.id === action.id ? next : g,
      );
      // Goals from before the budget-sync feature won't have a categoryId;
      // there's nothing to mirror so the simple update is enough.
      if (!categoryId) {
        return { ...state, savingsGoals };
      }
      let groups = state.groups;
      let transactions = state.transactions;
      if (action.patch.name !== undefined || action.patch.emoji !== undefined) {
        const oldName = existing.name;
        groups = syncSavingsCategory(groups, categoryId, {
          name: action.patch.name,
          emoji: action.patch.emoji,
        });
        if (
          action.patch.name !== undefined &&
          action.patch.name !== oldName
        ) {
          // Existing transactions tagged with the old category name need
          // to follow the rename so they continue to roll up correctly.
          const newName = action.patch.name;
          transactions = state.transactions.map((t) => {
            const splits = t.splits?.map((s) =>
              s.category === oldName ? { ...s, category: newName } : s,
            );
            const updated: Transaction = { ...t };
            if (t.category === oldName) updated.category = newName;
            if (splits) updated.splits = splits;
            return updated;
          });
        }
      }
      let targets = state.targets;
      if (
        action.patch.targetAmount !== undefined ||
        action.patch.dueDate !== undefined
      ) {
        const t = targetForSavingsGoal(next);
        const nextTargets = { ...state.targets };
        if (t) nextTargets[categoryId] = t;
        else delete nextTargets[categoryId];
        targets = nextTargets;
      }
      return {
        ...state,
        savingsGoals,
        groups,
        targets,
        transactions,
      };
    }
    case "delete_savings_goal": {
      const existing = state.savingsGoals.find((g) => g.id === action.id);
      const savingsGoals = state.savingsGoals.filter(
        (g) => g.id !== action.id,
      );
      if (!existing?.categoryId) {
        return { ...state, savingsGoals };
      }
      const cid = existing.categoryId;
      const ids = new Set([cid]);
      return {
        ...state,
        savingsGoals,
        groups: removeSavingsCategoryFromGroups(state.groups, cid),
        assignments: pruneAssignments(state.assignments, ids),
        targets: pruneTargets(state.targets, ids),
        pinnedCategoryIds: state.pinnedCategoryIds.filter((id) => id !== cid),
      };
    }
    case "add_savings_contribution":
      return {
        ...state,
        savingsGoals: state.savingsGoals.map((g) =>
          g.id === action.goalId
            ? {
                ...g,
                // Newest-first so the detail page lists recent activity at
                // the top without a sort step.
                contributions: [action.contribution, ...g.contributions],
              }
            : g,
        ),
      };
    case "delete_savings_contribution":
      return {
        ...state,
        savingsGoals: state.savingsGoals.map((g) =>
          g.id === action.goalId
            ? {
                ...g,
                contributions: g.contributions.filter(
                  (c) => c.id !== action.contributionId,
                ),
              }
            : g,
        ),
      };
    case "add_template":
      return { ...state, templates: [action.template, ...state.templates] };
    case "update_template":
      return {
        ...state,
        templates: state.templates.map((t) =>
          t.id === action.template.id ? action.template : t,
        ),
      };
    case "delete_template":
      return {
        ...state,
        templates: state.templates.filter((t) => t.id !== action.id),
      };
    case "set_assignment":
      return {
        ...state,
        assignments: setAssigned(
          state.assignments,
          action.monthKey,
          action.categoryId,
          action.amount,
        ),
      };
    case "toggle_pin": {
      const exists = state.pinnedCategoryIds.includes(action.categoryId);
      return {
        ...state,
        pinnedCategoryIds: exists
          ? state.pinnedCategoryIds.filter((id) => id !== action.categoryId)
          : [...state.pinnedCategoryIds, action.categoryId],
      };
    }
    case "set_target": {
      const next = { ...state.targets };
      if (action.target === null) delete next[action.categoryId];
      else next[action.categoryId] = action.target;
      return { ...state, targets: next };
    }
    case "add_group":
      return {
        ...state,
        groups: [
          ...state.groups,
          { id: makeId(), name: action.name, categories: [] },
        ],
      };
    case "rename_group":
      return {
        ...state,
        groups: state.groups.map((g) =>
          g.id === action.groupId ? { ...g, name: action.name } : g,
        ),
      };
    case "delete_group": {
      const group = state.groups.find((g) => g.id === action.groupId);
      if (!group) return state;
      const ids = new Set(group.categories.map((c) => c.id));
      return {
        ...state,
        groups: state.groups.filter((g) => g.id !== action.groupId),
        assignments: pruneAssignments(state.assignments, ids),
        targets: pruneTargets(state.targets, ids),
        pinnedCategoryIds: state.pinnedCategoryIds.filter((id) => !ids.has(id)),
      };
    }
    case "add_category":
      return {
        ...state,
        groups: state.groups.map((g) =>
          g.id === action.groupId
            ? {
                ...g,
                categories: [
                  ...g.categories,
                  { id: makeId(), name: action.name },
                ],
              }
            : g,
        ),
      };
    case "rename_category": {
      let oldName: string | null = null;
      for (const g of state.groups) {
        for (const c of g.categories) {
          if (c.id === action.categoryId) {
            oldName = c.name;
            break;
          }
        }
        if (oldName) break;
      }
      return {
        ...state,
        groups: state.groups.map((g) => ({
          ...g,
          categories: g.categories.map((c) =>
            c.id === action.categoryId ? { ...c, name: action.name } : c,
          ),
        })),
        // Keep transactions (and their splits) in sync — they reference
        // category by display name.
        transactions: oldName
          ? state.transactions.map((t) => {
              const oN = oldName as string;
              const nextSplits = t.splits?.map((s) =>
                s.category === oN ? { ...s, category: action.name } : s,
              );
              const next: Transaction = { ...t };
              if (t.category === oN) next.category = action.name;
              if (nextSplits) next.splits = nextSplits;
              return next;
            })
          : state.transactions,
      };
    }
    case "delete_category": {
      const ids = new Set([action.categoryId]);
      return {
        ...state,
        groups: state.groups.map((g) => ({
          ...g,
          categories: g.categories.filter((c) => c.id !== action.categoryId),
        })),
        assignments: pruneAssignments(state.assignments, ids),
        targets: pruneTargets(state.targets, ids),
        pinnedCategoryIds: state.pinnedCategoryIds.filter(
          (id) => id !== action.categoryId,
        ),
      };
    }
    case "move_group": {
      const idx = state.groups.findIndex((g) => g.id === action.groupId);
      const target = idx + action.delta;
      if (idx < 0 || target < 0 || target >= state.groups.length) return state;
      const next = state.groups.slice();
      [next[idx], next[target]] = [next[target], next[idx]];
      return { ...state, groups: next };
    }
    case "set_category_note": {
      const note = action.note.trim();
      return {
        ...state,
        groups: state.groups.map((g) => ({
          ...g,
          categories: g.categories.map((c) =>
            c.id === action.categoryId
              ? note === ""
                ? (() => {
                    const { note: _drop, ...rest } = c;
                    void _drop;
                    return rest;
                  })()
                : { ...c, note }
              : c,
          ),
        })),
      };
    }
    case "set_category_hidden":
      return {
        ...state,
        groups: state.groups.map((g) => ({
          ...g,
          categories: g.categories.map((c) => {
            if (c.id !== action.categoryId) return c;
            if (!action.hidden) {
              const { hidden: _drop, ...rest } = c;
              void _drop;
              return rest;
            }
            return { ...c, hidden: true };
          }),
        })),
      };
    case "set_category_emoji": {
      const trimmed = action.emoji.trim();
      return {
        ...state,
        groups: state.groups.map((g) => ({
          ...g,
          categories: g.categories.map((c) => {
            if (c.id !== action.categoryId) return c;
            if (trimmed === "") {
              const { emoji: _drop, ...rest } = c;
              void _drop;
              return rest;
            }
            return { ...c, emoji: trimmed };
          }),
        })),
      };
    }
    case "set_group_emoji": {
      const trimmed = action.emoji.trim();
      return {
        ...state,
        groups: state.groups.map((g) => {
          if (g.id !== action.groupId) return g;
          if (trimmed === "") {
            const { emoji: _drop, ...rest } = g;
            void _drop;
            return rest;
          }
          return { ...g, emoji: trimmed };
        }),
      };
    }
    case "set_account_note": {
      const note = action.note.trim();
      return {
        ...state,
        accounts: state.accounts.map((a) =>
          a.id === action.accountId
            ? note === ""
              ? (() => {
                  const { note: _drop, ...rest } = a;
                  void _drop;
                  return rest;
                })()
              : { ...a, note }
            : a,
        ),
      };
    }
    case "set_account_debt_terms": {
      return {
        ...state,
        accounts: state.accounts.map((a) => {
          if (a.id !== action.accountId) return a;
          const { apr: _apr, minimumPayment: _min, ...rest } = a;
          void _apr;
          void _min;
          const next: Account = { ...rest };
          if (action.apr !== null && Number.isFinite(action.apr)) {
            next.apr = action.apr;
          }
          if (
            action.minimumPayment !== null &&
            Number.isFinite(action.minimumPayment)
          ) {
            next.minimumPayment = action.minimumPayment;
          }
          return next;
        }),
      };
    }
    case "reorder_group": {
      const idx = state.groups.findIndex((g) => g.id === action.groupId);
      if (idx < 0) return state;
      const target = Math.max(
        0,
        Math.min(state.groups.length - 1, action.targetIndex),
      );
      if (target === idx) return state;
      const next = state.groups.slice();
      const [item] = next.splice(idx, 1);
      next.splice(target, 0, item);
      return { ...state, groups: next };
    }
    case "reorder_category": {
      const owner = state.groups.find((g) =>
        g.categories.some((c) => c.id === action.categoryId),
      );
      if (!owner) return state;
      const idx = owner.categories.findIndex(
        (c) => c.id === action.categoryId,
      );
      if (idx < 0) return state;
      const target = Math.max(
        0,
        Math.min(owner.categories.length - 1, action.targetIndex),
      );
      if (target === idx) return state;
      const reordered = owner.categories.slice();
      const [item] = reordered.splice(idx, 1);
      reordered.splice(target, 0, item);
      return {
        ...state,
        groups: state.groups.map((g) =>
          g.id === owner.id ? { ...g, categories: reordered } : g,
        ),
      };
    }
    case "move_category": {
      const owningGroup = state.groups.find((g) =>
        g.categories.some((c) => c.id === action.categoryId),
      );
      if (!owningGroup) return state;
      const idx = owningGroup.categories.findIndex(
        (c) => c.id === action.categoryId,
      );
      const target = idx + action.delta;
      if (target < 0 || target >= owningGroup.categories.length) return state;
      const reordered = owningGroup.categories.slice();
      [reordered[idx], reordered[target]] = [
        reordered[target],
        reordered[idx],
      ];
      return {
        ...state,
        groups: state.groups.map((g) =>
          g.id === owningGroup.id ? { ...g, categories: reordered } : g,
        ),
      };
    }
    case "add_planner_folder":
      return {
        ...state,
        plannerFolders: [...state.plannerFolders, action.folder],
      };
    case "rename_planner_folder":
      return {
        ...state,
        plannerFolders: state.plannerFolders.map((f) =>
          f.id === action.id ? { ...f, name: action.name } : f,
        ),
      };
    case "delete_planner_folder": {
      // Cascading delete: drop the folder, every budget pointing at it,
      // and every entry pointing at one of those budgets. Loose entries
      // would otherwise haunt the next migration with no way to surface
      // them.
      const droppedBudgetIds = new Set(
        state.plannerBudgets
          .filter((b) => b.folderId === action.id)
          .map((b) => b.id),
      );
      return {
        ...state,
        plannerFolders: state.plannerFolders.filter((f) => f.id !== action.id),
        plannerBudgets: state.plannerBudgets.filter(
          (b) => b.folderId !== action.id,
        ),
        plannerEntries: state.plannerEntries.filter(
          (e) => !droppedBudgetIds.has(e.budgetId),
        ),
      };
    }
    case "duplicate_planner_folder": {
      const source = state.plannerFolders.find((f) => f.id === action.sourceId);
      if (!source) return state;
      const newFolder: PlannerFolder = {
        id: action.newId,
        name: `${source.name} copy`,
      };
      const sourceBudgets = state.plannerBudgets.filter(
        (b) => b.folderId === action.sourceId,
      );
      // Mint fresh ids for the cloned budgets and remap their entries
      // onto the clones in one pass so the new folder is a self-contained
      // copy that doesn't share state with the original.
      const newBudgetIdByOld = new Map<string, string>();
      const newBudgets: PlannerBudget[] = sourceBudgets.map((b) => {
        const newId = `budget-${Math.random().toString(36).slice(2, 10)}`;
        newBudgetIdByOld.set(b.id, newId);
        return { id: newId, folderId: newFolder.id, name: b.name };
      });
      const newEntries: PlannerEntry[] = state.plannerEntries
        .filter((e) => newBudgetIdByOld.has(e.budgetId))
        .map((e) => ({
          ...e,
          id: `entry-${Math.random().toString(36).slice(2, 10)}`,
          budgetId: newBudgetIdByOld.get(e.budgetId)!,
        }));
      return {
        ...state,
        plannerFolders: [...state.plannerFolders, newFolder],
        plannerBudgets: [...state.plannerBudgets, ...newBudgets],
        plannerEntries: [...state.plannerEntries, ...newEntries],
      };
    }
    case "add_planner_budget":
      return {
        ...state,
        plannerBudgets: [...state.plannerBudgets, action.budget],
      };
    case "rename_planner_budget":
      return {
        ...state,
        plannerBudgets: state.plannerBudgets.map((b) =>
          b.id === action.id ? { ...b, name: action.name } : b,
        ),
      };
    case "delete_planner_budget":
      return {
        ...state,
        plannerBudgets: state.plannerBudgets.filter((b) => b.id !== action.id),
        plannerEntries: state.plannerEntries.filter(
          (e) => e.budgetId !== action.id,
        ),
      };
    case "duplicate_planner_budget": {
      const source = state.plannerBudgets.find(
        (b) => b.id === action.sourceId,
      );
      if (!source) return state;
      const targetFolderId = action.folderId ?? source.folderId;
      const newBudget: PlannerBudget = {
        id: action.newId,
        folderId: targetFolderId,
        name: `${source.name} copy`,
      };
      const newEntries: PlannerEntry[] = state.plannerEntries
        .filter((e) => e.budgetId === source.id)
        .map((e) => ({
          ...e,
          id: `entry-${Math.random().toString(36).slice(2, 10)}`,
          budgetId: newBudget.id,
        }));
      return {
        ...state,
        plannerBudgets: [...state.plannerBudgets, newBudget],
        plannerEntries: [...state.plannerEntries, ...newEntries],
      };
    }
    case "add_planner_entry": {
      // Append after the last existing entry in the same budget so the
      // new row lands at the bottom of the budget's ledger. Entries from
      // other budgets stay where they are.
      const next = state.plannerEntries.slice();
      let insertAt = next.length;
      for (let i = next.length - 1; i >= 0; i--) {
        if (next[i].budgetId === action.entry.budgetId) {
          insertAt = i + 1;
          break;
        }
      }
      next.splice(insertAt, 0, action.entry);
      return { ...state, plannerEntries: next };
    }
    case "update_planner_entry":
      return {
        ...state,
        plannerEntries: state.plannerEntries.map((e) =>
          e.id === action.entry.id ? action.entry : e,
        ),
      };
    case "delete_planner_entry":
      return {
        ...state,
        plannerEntries: state.plannerEntries.filter((e) => e.id !== action.id),
      };
    case "set_planner_entry_paid":
      return {
        ...state,
        plannerEntries: state.plannerEntries.map((e) =>
          e.id === action.id ? { ...e, paid: action.paid } : e,
        ),
      };
    case "reorder_planner_entry": {
      // Within-budget reorder only: cross-budget drags would silently
      // change the entry's budgetId. The drag UI shouldn't allow that.
      if (action.id === action.targetId) return state;
      const sourceIdx = state.plannerEntries.findIndex(
        (e) => e.id === action.id,
      );
      const target = state.plannerEntries.find((e) => e.id === action.targetId);
      if (sourceIdx < 0 || !target) return state;
      const source = state.plannerEntries[sourceIdx];
      if (source.budgetId !== target.budgetId) return state;
      const next = state.plannerEntries.slice();
      next.splice(sourceIdx, 1);
      const targetIdx = next.findIndex((e) => e.id === action.targetId);
      if (targetIdx < 0) return state;
      const insertAt =
        action.position === "after" ? targetIdx + 1 : targetIdx;
      next.splice(insertAt, 0, source);
      return { ...state, plannerEntries: next };
    }
    case "add_scheduled":
      return {
        ...state,
        scheduledTransactions: [
          ...state.scheduledTransactions,
          action.scheduled,
        ],
      };
    case "update_scheduled":
      return {
        ...state,
        scheduledTransactions: state.scheduledTransactions.map((s) =>
          s.id === action.scheduled.id ? action.scheduled : s,
        ),
      };
    case "delete_scheduled":
      return {
        ...state,
        scheduledTransactions: state.scheduledTransactions.filter(
          (s) => s.id !== action.id,
        ),
      };
    case "set_settings":
      return { ...state, settings: action.settings };
    case "restore":
      return {
        transactions: Array.isArray(action.payload.transactions)
          ? action.payload.transactions
          : state.transactions,
        accounts: Array.isArray(action.payload.accounts)
          ? action.payload.accounts
          : state.accounts,
        groups: Array.isArray(action.payload.groups)
          ? action.payload.groups
          : state.groups,
        assignments:
          action.payload.assignments &&
          typeof action.payload.assignments === "object" &&
          !Array.isArray(action.payload.assignments)
            ? action.payload.assignments
            : state.assignments,
        pinnedCategoryIds: Array.isArray(action.payload.pinnedCategoryIds)
          ? action.payload.pinnedCategoryIds
          : state.pinnedCategoryIds,
        targets:
          action.payload.targets &&
          typeof action.payload.targets === "object" &&
          !Array.isArray(action.payload.targets)
            ? action.payload.targets
            : state.targets,
        plannerFolders: Array.isArray(action.payload.plannerFolders)
          ? action.payload.plannerFolders
          : state.plannerFolders,
        plannerBudgets: Array.isArray(action.payload.plannerBudgets)
          ? action.payload.plannerBudgets
          : state.plannerBudgets,
        plannerEntries: Array.isArray(action.payload.plannerEntries)
          ? action.payload.plannerEntries
          : state.plannerEntries,
        scheduledTransactions: Array.isArray(action.payload.scheduledTransactions)
          ? action.payload.scheduledTransactions
          : state.scheduledTransactions,
        reconciliations: Array.isArray(action.payload.reconciliations)
          ? action.payload.reconciliations
          : state.reconciliations,
        monthNotes:
          action.payload.monthNotes &&
          typeof action.payload.monthNotes === "object" &&
          !Array.isArray(action.payload.monthNotes)
            ? action.payload.monthNotes
            : state.monthNotes,
        rules: Array.isArray(action.payload.rules)
          ? action.payload.rules
          : state.rules,
        wishlist: Array.isArray(action.payload.wishlist)
          ? action.payload.wishlist
          : state.wishlist,
        savingsGoals: Array.isArray(action.payload.savingsGoals)
          ? action.payload.savingsGoals
          : state.savingsGoals,
        templates: Array.isArray(action.payload.templates)
          ? action.payload.templates
          : state.templates,
        settings:
          action.payload.settings &&
          typeof action.payload.settings === "object" &&
          typeof (action.payload.settings as AppSettings).currency === "string"
            ? (action.payload.settings as AppSettings)
            : state.settings,
        hydrated: true,
      };
    case "auto_fund_recurring_targets": {
      let assignments = state.assignments;
      const ctx = ccPaymentRouting(state.accounts, state.groups);
      for (const g of state.groups) {
        for (const c of g.categories) {
          const t = state.targets[c.id];
          if (!t || !t.autoFund || t.paused) continue;
          const need = monthlyNeedForCategory(
            c,
            t,
            assignments,
            state.transactions,
            action.monthKey,
            ctx,
          );
          const have = getAssigned(assignments, action.monthKey, c.id);
          if (need > have) {
            assignments = setAssigned(assignments, action.monthKey, c.id, need);
          }
        }
      }
      if (assignments === state.assignments) return state;
      return { ...state, assignments };
    }
    case "post_due_scheduled": {
      const newTxs: Transaction[] = [];
      let changed = false;
      const updatedScheduled = state.scheduledTransactions.map((s) => {
        let nextDate = s.nextDate;
        while (nextDate <= action.today) {
          if (s.kind === "transfer") {
            const transferId = makeId();
            newTxs.push({
              id: makeId(),
              date: nextDate,
              payee: `Transfer to ${s.toAccount}`,
              category: "Transfer",
              amount: -s.amount,
              account: s.fromAccount,
              cleared: s.cleared ?? false,
              memo: s.memo,
              transferId,
            });
            newTxs.push({
              id: makeId(),
              date: nextDate,
              payee: `Transfer from ${s.fromAccount}`,
              category: "Transfer",
              amount: s.amount,
              account: s.toAccount,
              cleared: s.cleared ?? false,
              memo: s.memo,
              transferId,
            });
          } else {
            newTxs.push({
              id: makeId(),
              date: nextDate,
              payee: s.payee,
              category: s.category,
              amount: s.amount,
              account: s.account,
              cleared: false,
              memo: s.memo,
              isReadyToAssign: s.isReadyToAssign,
            });
          }
          nextDate = advanceDate(nextDate, s.cadence);
          changed = true;
        }
        return nextDate === s.nextDate ? s : { ...s, nextDate };
      });
      if (!changed) return state;
      return {
        ...state,
        transactions: [...newTxs, ...state.transactions],
        scheduledTransactions: updatedScheduled,
      };
    }
  }
}

type Ctx = {
  transactions: Transaction[];
  accounts: Account[];
  groups: BudgetCategoryGroup[];
  assignments: Assignments;
  pinnedCategoryIds: string[];
  targets: CategoryTargets;
  plannerFolders: PlannerFolder[];
  plannerBudgets: PlannerBudget[];
  plannerEntries: PlannerEntry[];
  scheduledTransactions: ScheduledTransaction[];
  addTransaction: (tx: Omit<Transaction, "id">) => void;
  addTransactions: (txs: Omit<Transaction, "id">[]) => void;
  updateTransaction: (tx: Transaction) => void;
  deleteTransaction: (id: string) => void;
  renamePayee: (oldName: string, newName: string) => void;
  addTransfer: (input: {
    date: string;
    fromAccount: string;
    toAccount: string;
    amount: number;
    cleared: boolean;
    memo?: string;
  }) => void;
  deleteTransfer: (transferId: string) => void;
  updateTransfer: (input: {
    transferId: string;
    date: string;
    memo: string | undefined;
    cleared: boolean;
  }) => void;
  addAccount: (account: Omit<Account, "id">) => void;
  renameAccount: (accountId: string, name: string) => void;
  setAccountClosed: (accountId: string, closed: boolean) => void;
  addInvestmentValuation: (
    accountId: string,
    valuation: Omit<InvestmentValuation, "id">,
  ) => void;
  deleteInvestmentValuation: (accountId: string, valuationId: string) => void;
  deleteAccount: (accountId: string) => void;
  reconcileAccount: (accountName: string, date: string) => void;
  monthNotes: Record<string, string>;
  setMonthNote: (monthKey: string, note: string) => void;
  rules: CategorizationRule[];
  addRule: (rule: Omit<CategorizationRule, "id">) => void;
  updateRule: (rule: CategorizationRule) => void;
  deleteRule: (ruleId: string) => void;
  reorderRules: (ruleIds: string[]) => void;
  wishlist: WishlistItem[];
  addWishlistItem: (item: Omit<WishlistItem, "id" | "createdAt">) => void;
  updateWishlistItem: (item: WishlistItem) => void;
  deleteWishlistItem: (id: string) => void;
  savingsGoals: SavingsGoal[];
  addSavingsGoal: (
    goal: Omit<
      SavingsGoal,
      "id" | "contributions" | "createdAt" | "categoryId"
    >,
  ) => void;
  updateSavingsGoal: (
    id: string,
    patch: Partial<
      Omit<SavingsGoal, "id" | "contributions" | "createdAt" | "categoryId">
    >,
  ) => void;
  deleteSavingsGoal: (id: string) => void;
  addSavingsContribution: (
    goalId: string,
    contribution: Omit<SavingsContribution, "id">,
  ) => void;
  deleteSavingsContribution: (goalId: string, contributionId: string) => void;
  templates: TransactionTemplate[];
  addTemplate: (template: Omit<TransactionTemplate, "id">) => void;
  updateTemplate: (template: TransactionTemplate) => void;
  deleteTemplate: (id: string) => void;
  reconciliations: Reconciliation[];
  recordReconciliation: (input: {
    accountId: string;
    date: string;
    bankBalance: number;
    adjustment: number;
  }) => void;
  setAssignment: (monthKey: string, categoryId: string, amount: number) => void;
  togglePin: (categoryId: string) => void;
  setTarget: (categoryId: string, target: CategoryTarget | null) => void;
  addGroup: (name: string) => void;
  renameGroup: (groupId: string, name: string) => void;
  deleteGroup: (groupId: string) => void;
  addCategory: (groupId: string, name: string) => void;
  renameCategory: (categoryId: string, name: string) => void;
  setCategoryNote: (categoryId: string, note: string) => void;
  setCategoryHidden: (categoryId: string, hidden: boolean) => void;
  setCategoryEmoji: (categoryId: string, emoji: string) => void;
  setGroupEmoji: (groupId: string, emoji: string) => void;
  deleteCategory: (categoryId: string) => void;
  moveGroup: (groupId: string, delta: -1 | 1) => void;
  moveCategory: (categoryId: string, delta: -1 | 1) => void;
  reorderGroup: (groupId: string, targetIndex: number) => void;
  reorderCategory: (categoryId: string, targetIndex: number) => void;
  setAccountNote: (accountId: string, note: string) => void;
  setAccountDebtTerms: (
    accountId: string,
    terms: { apr: number | null; minimumPayment: number | null },
  ) => void;
  addPlannerFolder: (name: string) => string;
  renamePlannerFolder: (id: string, name: string) => void;
  deletePlannerFolder: (id: string) => void;
  duplicatePlannerFolder: (sourceId: string) => string | null;
  addPlannerBudget: (folderId: string, name: string) => string;
  renamePlannerBudget: (id: string, name: string) => void;
  deletePlannerBudget: (id: string) => void;
  duplicatePlannerBudget: (
    sourceId: string,
    folderId?: string,
  ) => string | null;
  addPlannerEntry: (entry: Omit<PlannerEntry, "id">) => void;
  updatePlannerEntry: (entry: PlannerEntry) => void;
  deletePlannerEntry: (id: string) => void;
  setPlannerEntryPaid: (id: string, paid: boolean) => void;
  reorderPlannerEntry: (
    id: string,
    targetId: string,
    position: "before" | "after",
  ) => void;
  addScheduled: (s: ScheduledInput) => void;
  updateScheduled: (s: ScheduledTransaction) => void;
  deleteScheduled: (id: string) => void;
  settings: AppSettings;
  setSettings: (settings: AppSettings) => void;
  restoreFromBackup: (payload: Partial<State>) => void;
  exportBackup: () => Partial<State>;
  budgets: BudgetMeta[];
  currentBudgetId: string;
  currentBudgetHouseholdId: string | undefined;
  currentBudgetJoinCode: string | undefined;
  switchBudget: (id: string) => void;
  createBudget: (name: string) => void;
  renameBudget: (id: string, name: string) => void;
  deleteBudget: (id: string) => void;
  // Cloud sharing of the active budget. shareCurrentBudget creates a new
  // household owned by the signed-in user (taken via uid arg); the
  // returned join code is what they share with people they want to invite.
  // joinSharedBudget accepts either a code or a code+name and creates a
  // local budget pointing at the resolved household.
  shareCurrentBudget: (uid: string) => Promise<string | null>;
  unshareCurrentBudget: (uid: string) => Promise<void>;
  joinSharedBudget: (
    uid: string,
    joinCode: string,
    name: string,
  ) => Promise<{ ok: boolean; error?: string }>;
  // Snapshot the active budget into a new archive entry, then reset the
  // active budget so the new period starts clean (categories, accounts,
  // targets, and pins persist; transactions, assignments, planner entries,
  // and scheduled transactions are wiped).
  archiveAndReset: (archiveName: string) => void;
  // Undo support: callers stash a snapshot before destructive ops; the toast
  // (rendered at the layout level) lets the user roll back for ~6s.
  pendingUndo: { label: string; expiresAt: number } | null;
  markUndoable: (label: string) => void;
  applyUndo: () => void;
  dismissUndo: () => void;
};

const HorizonContext = createContext<Ctx | null>(null);

function makeId(): string {
  return Math.random().toString(36).slice(2, 10);
}

function pruneAssignments(
  assignments: Assignments,
  deletedIds: Set<string>,
): Assignments {
  const next: Assignments = {};
  for (const [mk, monthMap] of Object.entries(assignments)) {
    const filtered: Record<string, number> = {};
    for (const [cId, amt] of Object.entries(monthMap)) {
      if (!deletedIds.has(cId)) filtered[cId] = amt;
    }
    if (Object.keys(filtered).length > 0) next[mk] = filtered;
  }
  return next;
}

function pruneTargets(
  targets: CategoryTargets,
  deletedIds: Set<string>,
): CategoryTargets {
  const next: CategoryTargets = {};
  for (const [cId, t] of Object.entries(targets)) {
    if (!deletedIds.has(cId)) next[cId] = t;
  }
  return next;
}

// v4 stored targets as { kind: "monthly", amount } before set-aside/refill
// existed. Upgrade them in place so nothing has to know about the old kind.
function migrateTargets(
  raw: Record<string, unknown>,
): CategoryTargets {
  const out: CategoryTargets = {};
  for (const [id, value] of Object.entries(raw)) {
    if (!value || typeof value !== "object") continue;
    const v = value as Record<string, unknown>;
    const flags = {
      ...(v.paused === true ? { paused: true as const } : {}),
      ...(v.autoFund === true ? { autoFund: true as const } : {}),
    };
    if (v.kind === "monthly" && typeof v.amount === "number") {
      out[id] = {
        kind: "set-aside",
        amount: v.amount,
        cadence: "monthly",
        ...flags,
      };
      continue;
    }
    if (
      v.kind === "set-aside" &&
      typeof v.amount === "number" &&
      (v.cadence === "weekly" ||
        v.cadence === "monthly" ||
        v.cadence === "yearly")
    ) {
      out[id] = {
        kind: "set-aside",
        amount: v.amount,
        cadence: v.cadence,
        ...flags,
      };
      continue;
    }
    if (v.kind === "refill" && typeof v.amount === "number") {
      out[id] = { kind: "refill", amount: v.amount, ...flags };
      continue;
    }
    if (v.kind === "spending" && typeof v.amount === "number") {
      out[id] = { kind: "spending", amount: v.amount, ...flags };
      continue;
    }
    if (
      v.kind === "by-date" &&
      typeof v.amount === "number" &&
      typeof v.dueDate === "string"
    ) {
      out[id] = {
        kind: "by-date",
        amount: v.amount,
        dueDate: v.dueDate,
        ...flags,
      };
    }
  }
  return out;
}

export function HorizonStoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  // The active budget id and registry of all known budgets. Hydrated from
  // localStorage on mount; null until then so we don't persist before we
  // know which budget we're persisting under.
  const [budgetIndex, setBudgetIndex] = useState<BudgetsIndex | null>(null);

  // Hydrate from localStorage once on mount. Resolves the active budget via
  // the registry, migrating the legacy single-budget key on first run.
  useEffect(() => {
    let index = readBudgetsIndex();
    if (!index) {
      // First launch with the multi-budget layout. Either move the legacy
      // store payload under a "default" budget id, or seed an empty default.
      const legacyRaw = localStorage.getItem(LEGACY_STORAGE_KEY);
      if (legacyRaw) {
        try {
          localStorage.setItem(storageKeyFor(DEFAULT_BUDGET_ID), legacyRaw);
        } catch {
          // ignore
        }
      }
      index = {
        currentBudgetId: DEFAULT_BUDGET_ID,
        budgets: [{ id: DEFAULT_BUDGET_ID, name: DEFAULT_BUDGET_NAME }],
      };
      writeBudgetsIndex(index);
    }
    setBudgetIndex(index);

    try {
      const raw = localStorage.getItem(storageKeyFor(index.currentBudgetId));
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<State>;
        if (
          parsed &&
          Array.isArray(parsed.transactions) &&
          Array.isArray(parsed.accounts) &&
          Array.isArray(parsed.groups)
        ) {
          dispatch({
            type: "hydrate",
            transactions: parsed.transactions,
            accounts: parsed.accounts,
            groups: parsed.groups,
            assignments:
              parsed.assignments &&
              typeof parsed.assignments === "object" &&
              !Array.isArray(parsed.assignments)
                ? (parsed.assignments as Assignments)
                : {},
            pinnedCategoryIds: Array.isArray(parsed.pinnedCategoryIds)
              ? parsed.pinnedCategoryIds
              : [],
            targets:
              parsed.targets &&
              typeof parsed.targets === "object" &&
              !Array.isArray(parsed.targets)
                ? migrateTargets(parsed.targets as Record<string, unknown>)
                : {},
            ...(() => {
              // Migrate from the pre-folders Planner shape: entries used
              // to have a required `date` and no `budgetId`. If we see
              // any orphans, drop them into a "Migrated entries" budget
              // under the first available folder so users don't lose
              // anything we'd otherwise filter out by budgetId.
              const folders = Array.isArray(parsed.plannerFolders)
                ? (parsed.plannerFolders as PlannerFolder[])
                : samplePlannerFolders;
              const budgets = Array.isArray(parsed.plannerBudgets)
                ? (parsed.plannerBudgets as PlannerBudget[])
                : [];
              const rawEntries = Array.isArray(parsed.plannerEntries)
                ? (parsed.plannerEntries as PlannerEntry[])
                : [];
              const orphan = rawEntries.some((e) => !e.budgetId);
              if (!orphan) {
                return {
                  plannerFolders: folders,
                  plannerBudgets: budgets,
                  plannerEntries: rawEntries,
                };
              }
              const homeFolder =
                folders[0] ??
                ({ id: "folder-migrated", name: "Migrated" } as PlannerFolder);
              const migratedBudget: PlannerBudget = {
                id: "budget-migrated",
                folderId: homeFolder.id,
                name: "Migrated entries",
              };
              const nextFolders = folders.length > 0 ? folders : [homeFolder];
              const nextBudgets = budgets.some((b) => b.id === migratedBudget.id)
                ? budgets
                : [...budgets, migratedBudget];
              const nextEntries = rawEntries.map((e) =>
                e.budgetId ? e : { ...e, budgetId: migratedBudget.id },
              );
              return {
                plannerFolders: nextFolders,
                plannerBudgets: nextBudgets,
                plannerEntries: nextEntries,
              };
            })(),
            scheduledTransactions: Array.isArray(parsed.scheduledTransactions)
              ? parsed.scheduledTransactions
              : [],
            reconciliations: Array.isArray(parsed.reconciliations)
              ? parsed.reconciliations
              : [],
            monthNotes:
              parsed.monthNotes &&
              typeof parsed.monthNotes === "object" &&
              !Array.isArray(parsed.monthNotes)
                ? (parsed.monthNotes as Record<string, string>)
                : {},
            rules: Array.isArray(parsed.rules)
              ? (parsed.rules as CategorizationRule[])
              : [],
            wishlist: Array.isArray(parsed.wishlist)
              ? (parsed.wishlist as WishlistItem[])
              : sampleWishlist,
            savingsGoals: Array.isArray(parsed.savingsGoals)
              ? (parsed.savingsGoals as SavingsGoal[])
              : sampleSavingsGoals,
            templates: Array.isArray(parsed.templates)
              ? (parsed.templates as TransactionTemplate[])
              : sampleTemplates,
            settings:
              parsed.settings &&
              typeof parsed.settings === "object" &&
              typeof (parsed.settings as AppSettings).currency === "string"
                ? (parsed.settings as AppSettings)
                : defaultSettings,
          });
          return;
        }
      }
    } catch {
      // ignore corrupt JSON / SecurityError
    }
    // Nothing valid stored — promote the seed to "hydrated" so persistence kicks in.
    dispatch({
      type: "hydrate",
      transactions: sampleTransactions,
      accounts: sampleAccounts,
      groups: sampleBudget,
      assignments: sampleAssignments,
      pinnedCategoryIds: [],
      targets: {},
      plannerFolders: samplePlannerFolders,
      plannerBudgets: samplePlannerBudgets,
      plannerEntries: samplePlannerEntries,
      scheduledTransactions: samplePlannerScheduled,
      reconciliations: [],
      monthNotes: {},
      rules: [],
      wishlist: sampleWishlist,
      savingsGoals: sampleSavingsGoals,
      templates: sampleTemplates,
      settings: defaultSettings,
    });
  }, []);

  // After hydration, materialize any scheduled transactions whose nextDate
  // is on or before today — catching up across multiple missed periods if
  // the app hasn't been opened in a while — and top up the current month's
  // assignment for every recurring auto-fund target.
  useEffect(() => {
    if (!state.hydrated) return;
    const today = new Date();
    dispatch({ type: "post_due_scheduled", today: todayIsoScheduled() });
    dispatch({
      type: "auto_fund_recurring_targets",
      monthKey: `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`,
    });
    // Only run once per hydration; subsequent state changes shouldn't retrigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.hydrated]);

  // Sync the currency formatter with the persisted setting.
  useEffect(() => {
    setCurrencyFormatter(state.settings.currency);
  }, [state.settings.currency]);

  // Apply the picked theme to <html> as a data-theme attribute. CSS
  // variables in globals.css scope every brand token to that attribute, so
  // a single attribute swap re-skins the whole app — no reload, no
  // re-render needed. The "auto" theme resolves to light or dark via
  // prefers-color-scheme and re-resolves when the system flips.
  useEffect(() => {
    if (typeof document === "undefined") return;
    const picked = state.settings.theme ?? "dark";
    if (picked !== "auto") {
      document.documentElement.setAttribute("data-theme", picked);
      return;
    }
    const mql = window.matchMedia("(prefers-color-scheme: light)");
    const apply = () => {
      document.documentElement.setAttribute(
        "data-theme",
        mql.matches ? "light" : "dark",
      );
    };
    apply();
    mql.addEventListener("change", apply);
    return () => mql.removeEventListener("change", apply);
  }, [state.settings.theme]);

  // Local notifications on app load — overspent categories and targets with
  // due dates inside the next 7 days. Dedup via localStorage so the same
  // alert doesn't fire repeatedly within a 24h window.
  useEffect(() => {
    if (!state.hydrated) return;
    if (typeof window === "undefined") return;
    if (!state.settings.notificationsEnabled) return;
    if (!("Notification" in window)) return;
    if (Notification.permission !== "granted") return;
    const now = new Date();
    const todayMs = now.getTime();
    const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

    const fired: { key: string; title: string; body: string }[] = [];
    const ctx = ccPaymentRouting(state.accounts, state.groups);

    for (const g of state.groups) {
      for (const c of g.categories) {
        if (c.hidden) continue;
        const available = (() => {
          // Avoid pulling categoryAvailable into the closure with an extra
          // import — the rollup is computed inline against transactions.
          let bal = 0;
          for (const [mk, monthMap] of Object.entries(state.assignments)) {
            if (mk > monthKey) continue;
            bal += monthMap[c.id] ?? 0;
          }
          for (const t of state.transactions) {
            if (t.isReadyToAssign || t.transferId) continue;
            const [y, mm] = t.date.split("-").map(Number);
            const tk = `${y}-${String(mm).padStart(2, "0")}`;
            if (tk > monthKey) continue;
            const ccPay = ctx.ccPaymentCategoryFor?.(t.account);
            if (t.splits) {
              for (const s of t.splits) {
                if (s.category === c.name) bal += s.amount;
                if (
                  ccPay &&
                  s.amount < 0 &&
                  s.category !== ccPay &&
                  c.name === ccPay
                ) {
                  bal += -s.amount;
                }
              }
            } else {
              if (t.category === c.name) bal += t.amount;
              if (
                ccPay &&
                t.amount < 0 &&
                t.category !== ccPay &&
                c.name === ccPay
              ) {
                bal += -t.amount;
              }
            }
          }
          return bal;
        })();
        if (available < 0) {
          fired.push({
            key: `overspend:${c.id}:${monthKey}`,
            title: "Category overspent",
            body: `${c.name} is at ${available.toFixed(2)} this month.`,
          });
        }
      }
    }

    for (const [catId, target] of Object.entries(state.targets)) {
      if (target.kind !== "by-date") continue;
      if (target.paused) continue;
      const due = new Date(target.dueDate);
      const daysOut = (due.getTime() - todayMs) / (1000 * 60 * 60 * 24);
      if (daysOut < 0 || daysOut > 7) continue;
      const cat = state.groups
        .flatMap((g) => g.categories)
        .find((c) => c.id === catId);
      if (!cat) continue;
      fired.push({
        key: `target-due:${catId}:${target.dueDate}`,
        title: "Target due soon",
        body: `${cat.name} target due ${target.dueDate}.`,
      });
    }

    // Spending alerts — fire once when a "spending" target crosses 80%
    // and once again at 100% in a given month. Dedup keys carry the month
    // so the alert fires fresh each new month.
    for (const [catId, target] of Object.entries(state.targets)) {
      if (target.kind !== "spending") continue;
      if (target.paused) continue;
      if (target.amount <= 0) continue;
      const cat = state.groups
        .flatMap((g) => g.categories)
        .find((c) => c.id === catId);
      if (!cat || cat.hidden) continue;
      let spent = 0;
      for (const t of state.transactions) {
        if (t.isReadyToAssign || t.transferId) continue;
        const [y, m] = t.date.split("-").map(Number);
        const tk = `${y}-${String(m).padStart(2, "0")}`;
        if (tk !== monthKey) continue;
        if (t.splits && t.splits.length > 0) {
          for (const s of t.splits) {
            if (s.category === cat.name && s.amount < 0) spent += -s.amount;
          }
        } else if (t.category === cat.name && t.amount < 0) {
          spent += -t.amount;
        }
      }
      const pct = spent / target.amount;
      if (pct >= 1) {
        fired.push({
          key: `spending-100:${catId}:${monthKey}`,
          title: `${cat.name} cap reached`,
          body: `Spent ${spent.toFixed(2)} of ${target.amount.toFixed(2)} this month.`,
        });
      } else if (pct >= 0.8) {
        fired.push({
          key: `spending-80:${catId}:${monthKey}`,
          title: `${cat.name} at ${Math.round(pct * 100)}%`,
          body: `Spent ${spent.toFixed(2)} of the ${target.amount.toFixed(2)} cap.`,
        });
      }
    }

    for (const f of fired) {
      const storageKey = `horizon-notified-${f.key}`;
      const last = Number(localStorage.getItem(storageKey) ?? "0");
      if (todayMs - last < 24 * 60 * 60 * 1000) continue;
      try {
        new Notification(f.title, { body: f.body });
        localStorage.setItem(storageKey, String(todayMs));
      } catch {
        // ignore
      }
    }
    // Run once per hydration; dedup is via localStorage.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.hydrated]);

  // Persist after hydration. Writes go to the active budget's key, not the
  // legacy single-budget key.
  useEffect(() => {
    if (!state.hydrated || !budgetIndex) return;
    try {
      localStorage.setItem(
        storageKeyFor(budgetIndex.currentBudgetId),
        JSON.stringify({
          transactions: state.transactions,
          accounts: state.accounts,
          groups: state.groups,
          assignments: state.assignments,
          pinnedCategoryIds: state.pinnedCategoryIds,
          targets: state.targets,
          plannerFolders: state.plannerFolders,
          plannerBudgets: state.plannerBudgets,
          plannerEntries: state.plannerEntries,
          scheduledTransactions: state.scheduledTransactions,
          reconciliations: state.reconciliations,
          monthNotes: state.monthNotes,
          rules: state.rules,
          wishlist: state.wishlist,
          savingsGoals: state.savingsGoals,
          templates: state.templates,
          settings: state.settings,
        }),
      );
    } catch {
      // ignore quota / SecurityError
    }
  }, [state, budgetIndex]);

  const addTransaction = useCallback((tx: Omit<Transaction, "id">) => {
    dispatch({ type: "add_transaction", tx: { id: makeId(), ...tx } });
  }, []);

  const addTransactions = useCallback((txs: Omit<Transaction, "id">[]) => {
    dispatch({
      type: "add_transactions",
      txs: txs.map((t) => ({ id: makeId(), ...t })),
    });
  }, []);

  const updateTransaction = useCallback((tx: Transaction) => {
    dispatch({ type: "update_transaction", tx });
  }, []);

  const deleteTransaction = useCallback((id: string) => {
    dispatch({ type: "delete_transaction", id });
  }, []);

  const renamePayee = useCallback((oldName: string, newName: string) => {
    const trimmed = newName.trim();
    if (trimmed === "") return;
    dispatch({ type: "rename_payee", oldName, newName: trimmed });
  }, []);

  const addTransfer = useCallback(
    (input: {
      date: string;
      fromAccount: string;
      toAccount: string;
      amount: number;
      cleared: boolean;
      memo?: string;
    }) => {
      dispatch({ type: "add_transfer", ...input });
    },
    [],
  );

  const deleteTransfer = useCallback((transferId: string) => {
    dispatch({ type: "delete_transfer", transferId });
  }, []);

  const updateTransfer = useCallback(
    (input: {
      transferId: string;
      date: string;
      memo: string | undefined;
      cleared: boolean;
    }) => {
      dispatch({ type: "update_transfer", ...input });
    },
    [],
  );

  const addAccount = useCallback((account: Omit<Account, "id">) => {
    dispatch({ type: "add_account", account: { id: makeId(), ...account } });
  }, []);
  const renameAccount = useCallback((accountId: string, name: string) => {
    dispatch({ type: "rename_account", accountId, name });
  }, []);
  const setAccountClosed = useCallback(
    (accountId: string, closed: boolean) => {
      dispatch({ type: "set_account_closed", accountId, closed });
    },
    [],
  );
  const addInvestmentValuation = useCallback(
    (accountId: string, valuation: Omit<InvestmentValuation, "id">) => {
      dispatch({
        type: "add_investment_valuation",
        accountId,
        valuation: { id: makeId(), ...valuation },
      });
    },
    [],
  );
  const deleteInvestmentValuation = useCallback(
    (accountId: string, valuationId: string) => {
      dispatch({ type: "delete_investment_valuation", accountId, valuationId });
    },
    [],
  );
  const deleteAccount = useCallback((accountId: string) => {
    dispatch({ type: "delete_account", accountId });
  }, []);
  const reconcileAccount = useCallback(
    (accountName: string, date: string) => {
      dispatch({ type: "reconcile_account", accountName, date });
    },
    [],
  );
  const setMonthNote = useCallback((monthKey: string, note: string) => {
    dispatch({ type: "set_month_note", monthKey, note });
  }, []);

  const addRule = useCallback((rule: Omit<CategorizationRule, "id">) => {
    dispatch({
      type: "add_rule",
      rule: { id: makeId(), ...rule },
    });
  }, []);
  const updateRule = useCallback((rule: CategorizationRule) => {
    dispatch({ type: "update_rule", rule });
  }, []);
  const deleteRule = useCallback((ruleId: string) => {
    dispatch({ type: "delete_rule", ruleId });
  }, []);
  const reorderRules = useCallback((ruleIds: string[]) => {
    dispatch({ type: "reorder_rules", ruleIds });
  }, []);

  const addWishlistItem = useCallback(
    (input: Omit<WishlistItem, "id" | "createdAt">) => {
      dispatch({
        type: "add_wishlist_item",
        item: {
          id: makeId(),
          createdAt: todayIsoScheduled(),
          ...input,
        },
      });
    },
    [],
  );
  const updateWishlistItem = useCallback((item: WishlistItem) => {
    dispatch({ type: "update_wishlist_item", item });
  }, []);
  const deleteWishlistItem = useCallback((id: string) => {
    dispatch({ type: "delete_wishlist_item", id });
  }, []);

  const addSavingsGoal = useCallback(
    (
      input: Omit<
        SavingsGoal,
        "id" | "contributions" | "createdAt" | "categoryId"
      >,
    ) => {
      dispatch({
        type: "add_savings_goal",
        goal: {
          id: makeId(),
          contributions: [],
          createdAt: todayIsoScheduled(),
          ...input,
        },
      });
    },
    [],
  );
  const updateSavingsGoal = useCallback(
    (
      id: string,
      patch: Partial<
        Omit<SavingsGoal, "id" | "contributions" | "createdAt" | "categoryId">
      >,
    ) => {
      dispatch({ type: "update_savings_goal", id, patch });
    },
    [],
  );
  const deleteSavingsGoal = useCallback((id: string) => {
    dispatch({ type: "delete_savings_goal", id });
  }, []);
  const addSavingsContribution = useCallback(
    (goalId: string, input: Omit<SavingsContribution, "id">) => {
      dispatch({
        type: "add_savings_contribution",
        goalId,
        contribution: { id: makeId(), ...input },
      });
    },
    [],
  );
  const deleteSavingsContribution = useCallback(
    (goalId: string, contributionId: string) => {
      dispatch({
        type: "delete_savings_contribution",
        goalId,
        contributionId,
      });
    },
    [],
  );

  const addTemplate = useCallback(
    (input: Omit<TransactionTemplate, "id">) => {
      dispatch({
        type: "add_template",
        template: { id: makeId(), ...input },
      });
    },
    [],
  );
  const updateTemplate = useCallback((template: TransactionTemplate) => {
    dispatch({ type: "update_template", template });
  }, []);
  const deleteTemplate = useCallback((id: string) => {
    dispatch({ type: "delete_template", id });
  }, []);

  const recordReconciliation = useCallback(
    (input: {
      accountId: string;
      date: string;
      bankBalance: number;
      adjustment: number;
    }) => {
      dispatch({
        type: "add_reconciliation",
        reconciliation: { id: makeId(), ...input },
      });
    },
    [],
  );

  const setAssignment = useCallback(
    (monthKey: string, categoryId: string, amount: number) => {
      dispatch({ type: "set_assignment", monthKey, categoryId, amount });
    },
    [],
  );

  const togglePin = useCallback((categoryId: string) => {
    dispatch({ type: "toggle_pin", categoryId });
  }, []);

  const setTarget = useCallback(
    (categoryId: string, target: CategoryTarget | null) => {
      dispatch({ type: "set_target", categoryId, target });
    },
    [],
  );

  const addGroup = useCallback((name: string) => {
    dispatch({ type: "add_group", name });
  }, []);
  const renameGroup = useCallback((groupId: string, name: string) => {
    dispatch({ type: "rename_group", groupId, name });
  }, []);
  const deleteGroup = useCallback((groupId: string) => {
    dispatch({ type: "delete_group", groupId });
  }, []);
  const addCategory = useCallback((groupId: string, name: string) => {
    dispatch({ type: "add_category", groupId, name });
  }, []);
  const renameCategory = useCallback((categoryId: string, name: string) => {
    dispatch({ type: "rename_category", categoryId, name });
  }, []);
  const deleteCategory = useCallback((categoryId: string) => {
    dispatch({ type: "delete_category", categoryId });
  }, []);
  const setCategoryNote = useCallback((categoryId: string, note: string) => {
    dispatch({ type: "set_category_note", categoryId, note });
  }, []);
  const setCategoryHidden = useCallback(
    (categoryId: string, hidden: boolean) => {
      dispatch({ type: "set_category_hidden", categoryId, hidden });
    },
    [],
  );
  const setCategoryEmoji = useCallback(
    (categoryId: string, emoji: string) => {
      dispatch({ type: "set_category_emoji", categoryId, emoji });
    },
    [],
  );
  const setGroupEmoji = useCallback((groupId: string, emoji: string) => {
    dispatch({ type: "set_group_emoji", groupId, emoji });
  }, []);
  const moveGroup = useCallback((groupId: string, delta: -1 | 1) => {
    dispatch({ type: "move_group", groupId, delta });
  }, []);
  const moveCategory = useCallback((categoryId: string, delta: -1 | 1) => {
    dispatch({ type: "move_category", categoryId, delta });
  }, []);
  const reorderGroup = useCallback((groupId: string, targetIndex: number) => {
    dispatch({ type: "reorder_group", groupId, targetIndex });
  }, []);
  const reorderCategory = useCallback(
    (categoryId: string, targetIndex: number) => {
      dispatch({ type: "reorder_category", categoryId, targetIndex });
    },
    [],
  );
  const setAccountNote = useCallback((accountId: string, note: string) => {
    dispatch({ type: "set_account_note", accountId, note });
  }, []);
  const setAccountDebtTerms = useCallback(
    (
      accountId: string,
      terms: { apr: number | null; minimumPayment: number | null },
    ) => {
      dispatch({
        type: "set_account_debt_terms",
        accountId,
        apr: terms.apr,
        minimumPayment: terms.minimumPayment,
      });
    },
    [],
  );

  const addPlannerFolder = useCallback((name: string) => {
    const id = `folder-${makeId()}`;
    dispatch({ type: "add_planner_folder", folder: { id, name } });
    return id;
  }, []);

  const renamePlannerFolder = useCallback((id: string, name: string) => {
    dispatch({ type: "rename_planner_folder", id, name });
  }, []);

  const deletePlannerFolder = useCallback((id: string) => {
    dispatch({ type: "delete_planner_folder", id });
  }, []);

  const duplicatePlannerFolder = useCallback((sourceId: string) => {
    const newId = `folder-${makeId()}`;
    dispatch({ type: "duplicate_planner_folder", sourceId, newId });
    return newId;
  }, []);

  const addPlannerBudget = useCallback((folderId: string, name: string) => {
    const id = `budget-${makeId()}`;
    dispatch({
      type: "add_planner_budget",
      budget: { id, folderId, name },
    });
    return id;
  }, []);

  const renamePlannerBudget = useCallback((id: string, name: string) => {
    dispatch({ type: "rename_planner_budget", id, name });
  }, []);

  const deletePlannerBudget = useCallback((id: string) => {
    dispatch({ type: "delete_planner_budget", id });
  }, []);

  const duplicatePlannerBudget = useCallback(
    (sourceId: string, folderId?: string) => {
      const newId = `budget-${makeId()}`;
      dispatch({
        type: "duplicate_planner_budget",
        sourceId,
        newId,
        folderId,
      });
      return newId;
    },
    [],
  );

  const addPlannerEntry = useCallback((entry: Omit<PlannerEntry, "id">) => {
    dispatch({
      type: "add_planner_entry",
      entry: { id: makeId(), ...entry },
    });
  }, []);

  const updatePlannerEntry = useCallback((entry: PlannerEntry) => {
    dispatch({ type: "update_planner_entry", entry });
  }, []);

  const deletePlannerEntry = useCallback((id: string) => {
    dispatch({ type: "delete_planner_entry", id });
  }, []);

  const setPlannerEntryPaid = useCallback((id: string, paid: boolean) => {
    dispatch({ type: "set_planner_entry_paid", id, paid });
  }, []);

  const reorderPlannerEntry = useCallback(
    (id: string, targetId: string, position: "before" | "after") => {
      dispatch({ type: "reorder_planner_entry", id, targetId, position });
    },
    [],
  );

  const addScheduled = useCallback(
    (scheduled: ScheduledInput) => {
      dispatch({
        type: "add_scheduled",
        scheduled: { id: makeId(), ...scheduled } as ScheduledTransaction,
      });
    },
    [],
  );

  const updateScheduled = useCallback((scheduled: ScheduledTransaction) => {
    dispatch({ type: "update_scheduled", scheduled });
  }, []);

  const deleteScheduled = useCallback((id: string) => {
    dispatch({ type: "delete_scheduled", id });
  }, []);

  const setSettings = useCallback((settings: AppSettings) => {
    dispatch({ type: "set_settings", settings });
  }, []);

  const restoreFromBackup = useCallback((payload: Partial<State>) => {
    dispatch({ type: "restore", payload });
  }, []);

  // Budget registry actions. Switch + delete force a page reload after
  // updating storage so the store rehydrates against the new active id; this
  // sidesteps the complication of swapping all per-budget state in place.
  const persistCurrentBudget = useCallback(() => {
    if (!state.hydrated || !budgetIndex) return;
    try {
      localStorage.setItem(
        storageKeyFor(budgetIndex.currentBudgetId),
        JSON.stringify({
          transactions: state.transactions,
          accounts: state.accounts,
          groups: state.groups,
          assignments: state.assignments,
          pinnedCategoryIds: state.pinnedCategoryIds,
          targets: state.targets,
          plannerFolders: state.plannerFolders,
          plannerBudgets: state.plannerBudgets,
          plannerEntries: state.plannerEntries,
          scheduledTransactions: state.scheduledTransactions,
          settings: state.settings,
        }),
      );
    } catch {
      // ignore
    }
  }, [state, budgetIndex]);

  const switchBudget = useCallback(
    (id: string) => {
      if (!budgetIndex || id === budgetIndex.currentBudgetId) return;
      if (!budgetIndex.budgets.some((b) => b.id === id)) return;
      persistCurrentBudget();
      writeBudgetsIndex({ ...budgetIndex, currentBudgetId: id });
      if (typeof window !== "undefined") window.location.assign("/");
    },
    [budgetIndex, persistCurrentBudget],
  );

  const createBudget = useCallback(
    (name: string) => {
      const trimmed = name.trim();
      if (!budgetIndex || trimmed === "") return;
      const id = makeId();
      // Seed the new budget with a fresh sample state.
      try {
        localStorage.setItem(
          storageKeyFor(id),
          JSON.stringify({
            transactions: sampleTransactions,
            accounts: sampleAccounts,
            groups: sampleBudget,
            assignments: sampleAssignments,
            pinnedCategoryIds: [],
            targets: {},
            plannerFolders: samplePlannerFolders,
            plannerBudgets: samplePlannerBudgets,
            plannerEntries: samplePlannerEntries,
            scheduledTransactions: samplePlannerScheduled,
            settings: { currency: state.settings.currency },
          }),
        );
      } catch {
        // ignore
      }
      const next: BudgetsIndex = {
        currentBudgetId: id,
        budgets: [...budgetIndex.budgets, { id, name: trimmed }],
      };
      persistCurrentBudget();
      writeBudgetsIndex(next);
      if (typeof window !== "undefined") window.location.assign("/");
    },
    [budgetIndex, state.settings.currency, persistCurrentBudget],
  );

  const renameBudget = useCallback(
    (id: string, name: string) => {
      if (!budgetIndex) return;
      const trimmed = name.trim();
      if (trimmed === "") return;
      const next: BudgetsIndex = {
        ...budgetIndex,
        budgets: budgetIndex.budgets.map((b) =>
          b.id === id ? { ...b, name: trimmed } : b,
        ),
      };
      writeBudgetsIndex(next);
      setBudgetIndex(next);
    },
    [budgetIndex],
  );

  const shareCurrentBudget = useCallback(
    async (uid: string): Promise<string | null> => {
      if (!budgetIndex) return null;
      const current = budgetIndex.budgets.find(
        (b) => b.id === budgetIndex.currentBudgetId,
      );
      if (!current) return null;
      if (current.joinCode) return current.joinCode;
      // Create a fresh household owned by the caller and a paired join
      // code. The household doc satisfies the rules' create check
      // (owner == caller, members == [caller]) and the joinCode write is
      // allowed because the caller is the owner of the just-created
      // household. Bails silently if Firebase isn't configured.
      const created = await createHousehold(uid);
      if (!created) return null;
      const next: BudgetsIndex = {
        ...budgetIndex,
        budgets: budgetIndex.budgets.map((b) =>
          b.id === current.id
            ? {
                ...b,
                householdId: created.householdId,
                joinCode: created.joinCode,
              }
            : b,
        ),
      };
      writeBudgetsIndex(next);
      setBudgetIndex(next);
      return created.joinCode;
    },
    [budgetIndex],
  );

  const unshareCurrentBudget = useCallback(
    async (uid: string): Promise<void> => {
      if (!budgetIndex) return;
      const current = budgetIndex.budgets.find(
        (b) => b.id === budgetIndex.currentBudgetId,
      );
      const householdId = current?.householdId;
      // Drop the local link first so sync stops pushing immediately.
      const next: BudgetsIndex = {
        ...budgetIndex,
        budgets: budgetIndex.budgets.map((b) => {
          if (b.id !== budgetIndex.currentBudgetId) return b;
          const { householdId: _h, joinCode: _c, ...rest } = b;
          void _h;
          void _c;
          return rest;
        }),
      };
      writeBudgetsIndex(next);
      setBudgetIndex(next);
      // Best-effort remove the caller from the remote member list. If we
      // were the owner the doc stays around; cleanup of dangling
      // households is out of scope for now.
      if (householdId) {
        try {
          await leaveHousehold(householdId, uid);
        } catch {
          /* swallow — we already disconnected locally */
        }
      }
    },
    [budgetIndex],
  );

  const joinSharedBudget = useCallback(
    async (
      uid: string,
      joinCode: string,
      name: string,
    ): Promise<{ ok: boolean; error?: string }> => {
      const trimmedCode = joinCode.trim().toLowerCase();
      const trimmedName = name.trim();
      if (!budgetIndex || trimmedCode === "" || trimmedName === "") {
        return { ok: false, error: "Code and name are required." };
      }
      // Bail if we already have a local budget pointing at this code.
      if (budgetIndex.budgets.some((b) => b.joinCode === trimmedCode)) {
        return { ok: false, error: "You're already in this household." };
      }
      const householdId = await resolveJoinCode(trimmedCode);
      if (!householdId) {
        return { ok: false, error: "Invite code not recognised." };
      }
      try {
        await joinHousehold(householdId, uid);
      } catch {
        return {
          ok: false,
          error: "Couldn't join — check the code or your connection.",
        };
      }
      const id = makeId();
      // Seed empty local state — initial sync from the cloud overrides.
      try {
        localStorage.setItem(
          storageKeyFor(id),
          JSON.stringify({
            transactions: [],
            accounts: sampleAccounts,
            groups: sampleBudget,
            assignments: {},
            pinnedCategoryIds: [],
            targets: {},
            plannerFolders: [],
            plannerBudgets: [],
            plannerEntries: [],
            scheduledTransactions: [],
            settings: { currency: state.settings.currency },
          }),
        );
      } catch {
        // ignore
      }
      const next: BudgetsIndex = {
        currentBudgetId: id,
        budgets: [
          ...budgetIndex.budgets,
          {
            id,
            name: trimmedName,
            householdId,
            joinCode: trimmedCode,
          },
        ],
      };
      writeBudgetsIndex(next);
      if (typeof window !== "undefined") window.location.assign("/");
      return { ok: true };
    },
    [budgetIndex, state.settings.currency],
  );

  const archiveAndReset = useCallback(
    (archiveName: string) => {
      if (!budgetIndex) return;
      const trimmed = archiveName.trim();
      if (trimmed === "") return;
      const archiveId = makeId();
      // Persist a full snapshot of the live state under the archive id —
      // including reconciliations, monthNotes, and rules so peeking at the
      // archive later is faithful to what the user had at reset time.
      try {
        localStorage.setItem(
          storageKeyFor(archiveId),
          JSON.stringify({
            transactions: state.transactions,
            accounts: state.accounts,
            groups: state.groups,
            assignments: state.assignments,
            pinnedCategoryIds: state.pinnedCategoryIds,
            targets: state.targets,
            plannerFolders: state.plannerFolders,
            plannerBudgets: state.plannerBudgets,
            plannerEntries: state.plannerEntries,
            scheduledTransactions: state.scheduledTransactions,
            reconciliations: state.reconciliations,
            monthNotes: state.monthNotes,
            rules: state.rules,
            wishlist: state.wishlist,
            savingsGoals: state.savingsGoals,
            templates: state.templates,
            settings: state.settings,
          }),
        );
      } catch {
        // ignore
      }
      const next: BudgetsIndex = {
        ...budgetIndex,
        budgets: [...budgetIndex.budgets, { id: archiveId, name: trimmed }],
      };
      writeBudgetsIndex(next);
      setBudgetIndex(next);

      // Reset the live budget. Goal: every budget number reads cleanly to
      // zero AND the user's actual cash isn't stranded on account rows.
      //
      // For each non-tracking asset account, capture its live balance now,
      // then set the persisted starting balance to zero and re-seed a
      // Starting Balance transaction tagged isReadyToAssign for the same
      // amount. After reset, the account's live balance is unchanged but
      // the cash is once again flowing into RTA — matching how onboarding
      // sets up a fresh budget.
      //
      // Liability and tracking accounts keep their live balance on the
      // account row (no seed transaction) so the debt / off-budget cash
      // is preserved without bumping RTA.
      const today = todayIsoScheduled();
      const seedTxs: Transaction[] = [];
      const resetAccounts: Account[] = state.accounts.map((account) => {
        const live = liveAccountBalance(account, state.transactions);
        if (
          !account.tracking &&
          ASSET_ACCOUNT_TYPES.has(account.type) &&
          // Investment accounts hold market value, not spendable cash —
          // never seed RTA from them. They fall through to the balance-
          // preserving else branch.
          account.type !== "investment" &&
          live !== 0
        ) {
          seedTxs.push({
            id: makeId(),
            date: today,
            payee: "Starting Balance",
            category: READY_TO_ASSIGN_CATEGORY,
            amount: live,
            account: account.name,
            cleared: true,
            isReadyToAssign: true,
          });
          return { ...account, balance: 0 };
        }
        // Non-asset accounts (CC, loans, tracking) — fold the live balance
        // back onto the account so wiping transactions doesn't change the
        // visible balance.
        return { ...account, balance: live };
      });

      dispatch({
        type: "restore",
        payload: {
          transactions: seedTxs,
          accounts: resetAccounts,
          groups: state.groups,
          assignments: {},
          pinnedCategoryIds: state.pinnedCategoryIds,
          targets: state.targets,
          plannerFolders: [],
          plannerBudgets: [],
          plannerEntries: [],
          scheduledTransactions: [],
          reconciliations: [],
          monthNotes: {},
          rules: state.rules,
          wishlist: [],
          savingsGoals: [],
          templates: state.templates,
          settings: state.settings,
        },
      });
    },
    [budgetIndex, state],
  );

  const deleteBudget = useCallback(
    (id: string) => {
      if (!budgetIndex) return;
      if (budgetIndex.budgets.length <= 1) return; // never leave the user with zero budgets
      try {
        localStorage.removeItem(storageKeyFor(id));
      } catch {
        // ignore
      }
      const remaining = budgetIndex.budgets.filter((b) => b.id !== id);
      const nextActive =
        budgetIndex.currentBudgetId === id
          ? remaining[0].id
          : budgetIndex.currentBudgetId;
      const next: BudgetsIndex = {
        currentBudgetId: nextActive,
        budgets: remaining,
      };
      writeBudgetsIndex(next);
      if (nextActive !== budgetIndex.currentBudgetId) {
        if (typeof window !== "undefined") window.location.assign("/");
      } else {
        setBudgetIndex(next);
      }
    },
    [budgetIndex],
  );

  // Pending-undo holds a snapshot of state right before a destructive op,
  // along with a friendly label and expiry timestamp. Persisting this would
  // make storage churn for transient state, so it's RAM-only.
  const [pendingUndo, setPendingUndo] = useState<{
    label: string;
    snapshot: Partial<State>;
    expiresAt: number;
  } | null>(null);

  const markUndoable = useCallback(
    (label: string) => {
      setPendingUndo({
        label,
        snapshot: {
          transactions: state.transactions,
          accounts: state.accounts,
          groups: state.groups,
          assignments: state.assignments,
          pinnedCategoryIds: state.pinnedCategoryIds,
          targets: state.targets,
          plannerFolders: state.plannerFolders,
          plannerBudgets: state.plannerBudgets,
          plannerEntries: state.plannerEntries,
          scheduledTransactions: state.scheduledTransactions,
          settings: state.settings,
        },
        expiresAt: Date.now() + 6000,
      });
    },
    [state],
  );

  const applyUndo = useCallback(() => {
    if (!pendingUndo) return;
    dispatch({ type: "restore", payload: pendingUndo.snapshot });
    setPendingUndo(null);
  }, [pendingUndo]);

  const dismissUndo = useCallback(() => setPendingUndo(null), []);

  // Auto-expire the undo banner.
  useEffect(() => {
    if (!pendingUndo) return;
    const remaining = pendingUndo.expiresAt - Date.now();
    if (remaining <= 0) {
      setPendingUndo(null);
      return;
    }
    const handle = window.setTimeout(() => setPendingUndo(null), remaining);
    return () => window.clearTimeout(handle);
  }, [pendingUndo]);

  const stateRef = state; // captured for the exporter below
  const exportBackup = useCallback((): Partial<State> => {
    return {
      transactions: stateRef.transactions,
      accounts: stateRef.accounts,
      groups: stateRef.groups,
      assignments: stateRef.assignments,
      pinnedCategoryIds: stateRef.pinnedCategoryIds,
      targets: stateRef.targets,
      plannerFolders: stateRef.plannerFolders,
      plannerBudgets: stateRef.plannerBudgets,
      plannerEntries: stateRef.plannerEntries,
      scheduledTransactions: stateRef.scheduledTransactions,
      settings: stateRef.settings,
    };
  }, [stateRef]);

  const value = useMemo<Ctx>(
    () => ({
      transactions: state.transactions,
      accounts: state.accounts,
      groups: state.groups,
      assignments: state.assignments,
      pinnedCategoryIds: state.pinnedCategoryIds,
      targets: state.targets,
      plannerFolders: state.plannerFolders,
      plannerBudgets: state.plannerBudgets,
      plannerEntries: state.plannerEntries,
      scheduledTransactions: state.scheduledTransactions,
      addTransaction,
      addTransactions,
      updateTransaction,
      deleteTransaction,
      renamePayee,
      addTransfer,
      deleteTransfer,
      updateTransfer,
      addAccount,
      renameAccount,
      setAccountClosed,
      addInvestmentValuation,
      deleteInvestmentValuation,
      deleteAccount,
      reconcileAccount,
      monthNotes: state.monthNotes,
      setMonthNote,
      rules: state.rules,
      addRule,
      updateRule,
      deleteRule,
      reorderRules,
      wishlist: state.wishlist,
      addWishlistItem,
      updateWishlistItem,
      deleteWishlistItem,
      savingsGoals: state.savingsGoals,
      addSavingsGoal,
      updateSavingsGoal,
      deleteSavingsGoal,
      addSavingsContribution,
      deleteSavingsContribution,
      templates: state.templates,
      addTemplate,
      updateTemplate,
      deleteTemplate,
      reconciliations: state.reconciliations,
      recordReconciliation,
      setAssignment,
      togglePin,
      setTarget,
      addGroup,
      renameGroup,
      deleteGroup,
      addCategory,
      renameCategory,
      setCategoryNote,
      setCategoryHidden,
      setCategoryEmoji,
      setGroupEmoji,
      deleteCategory,
      moveGroup,
      moveCategory,
      reorderGroup,
      reorderCategory,
      setAccountNote,
      setAccountDebtTerms,
      addPlannerFolder,
      renamePlannerFolder,
      deletePlannerFolder,
      duplicatePlannerFolder,
      addPlannerBudget,
      renamePlannerBudget,
      deletePlannerBudget,
      duplicatePlannerBudget,
      addPlannerEntry,
      updatePlannerEntry,
      deletePlannerEntry,
      setPlannerEntryPaid,
      reorderPlannerEntry,
      addScheduled,
      updateScheduled,
      deleteScheduled,
      settings: state.settings,
      setSettings,
      restoreFromBackup,
      exportBackup,
      budgets: budgetIndex?.budgets ?? [],
      currentBudgetId: budgetIndex?.currentBudgetId ?? DEFAULT_BUDGET_ID,
      currentBudgetHouseholdId: budgetIndex?.budgets.find(
        (b) => b.id === budgetIndex.currentBudgetId,
      )?.householdId,
      currentBudgetJoinCode: budgetIndex?.budgets.find(
        (b) => b.id === budgetIndex.currentBudgetId,
      )?.joinCode,
      switchBudget,
      createBudget,
      renameBudget,
      deleteBudget,
      shareCurrentBudget,
      unshareCurrentBudget,
      joinSharedBudget,
      archiveAndReset,
      pendingUndo: pendingUndo
        ? { label: pendingUndo.label, expiresAt: pendingUndo.expiresAt }
        : null,
      markUndoable,
      applyUndo,
      dismissUndo,
    }),
    [
      state.transactions,
      state.accounts,
      state.groups,
      state.assignments,
      state.pinnedCategoryIds,
      state.targets,
      state.plannerFolders,
      state.plannerBudgets,
      state.plannerEntries,
      state.scheduledTransactions,
      addTransaction,
      addTransactions,
      updateTransaction,
      deleteTransaction,
      renamePayee,
      addTransfer,
      deleteTransfer,
      updateTransfer,
      addAccount,
      renameAccount,
      setAccountClosed,
      addInvestmentValuation,
      deleteInvestmentValuation,
      deleteAccount,
      reconcileAccount,
      state.monthNotes,
      setMonthNote,
      state.rules,
      addRule,
      updateRule,
      deleteRule,
      reorderRules,
      state.wishlist,
      addWishlistItem,
      updateWishlistItem,
      deleteWishlistItem,
      state.savingsGoals,
      addSavingsGoal,
      updateSavingsGoal,
      deleteSavingsGoal,
      addSavingsContribution,
      deleteSavingsContribution,
      state.templates,
      addTemplate,
      updateTemplate,
      deleteTemplate,
      state.reconciliations,
      recordReconciliation,
      setAssignment,
      togglePin,
      setTarget,
      addGroup,
      renameGroup,
      deleteGroup,
      addCategory,
      renameCategory,
      setCategoryNote,
      setCategoryHidden,
      setCategoryEmoji,
      setGroupEmoji,
      deleteCategory,
      moveGroup,
      moveCategory,
      reorderGroup,
      reorderCategory,
      setAccountNote,
      setAccountDebtTerms,
      addPlannerFolder,
      renamePlannerFolder,
      deletePlannerFolder,
      duplicatePlannerFolder,
      addPlannerBudget,
      renamePlannerBudget,
      deletePlannerBudget,
      duplicatePlannerBudget,
      addPlannerEntry,
      updatePlannerEntry,
      deletePlannerEntry,
      setPlannerEntryPaid,
      reorderPlannerEntry,
      addScheduled,
      updateScheduled,
      deleteScheduled,
      state.settings,
      setSettings,
      restoreFromBackup,
      exportBackup,
      budgetIndex,
      switchBudget,
      createBudget,
      renameBudget,
      deleteBudget,
      shareCurrentBudget,
      unshareCurrentBudget,
      joinSharedBudget,
      archiveAndReset,
      pendingUndo,
      markUndoable,
      applyUndo,
      dismissUndo,
    ],
  );

  return (
    <HorizonContext.Provider value={value}>
      {state.hydrated ? (
        children
      ) : (
        <div
          aria-hidden
          className="fixed inset-0 bg-page grid place-items-center"
        >
          <div className="h-9 w-9 rounded-full border-[3px] border-fg/20 border-t-accent animate-spin" />
        </div>
      )}
    </HorizonContext.Provider>
  );
}

export function useHorizonStore(): Ctx {
  const ctx = useContext(HorizonContext);
  if (!ctx) {
    throw new Error(
      "useHorizonStore must be used inside <HorizonStoreProvider>",
    );
  }
  return ctx;
}
