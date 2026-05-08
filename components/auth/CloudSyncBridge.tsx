"use client";

import { useEffect, useRef } from "react";
import { useAuth } from "@/components/auth/AuthContext";
import { useHorizonStore } from "@/components/store/HorizonStore";
import {
  pullBudget,
  pullHouseholdBudget,
  pushBudget,
  pushHouseholdBudget,
  subscribeBudget,
  subscribeHouseholdBudget,
  type CloudBudgetDoc,
} from "@/lib/cloudSync";

const PUSH_DEBOUNCE_MS = 2000;

// Heuristic for "the user hasn't really used this budget yet". When local
// is in this state at first sync, we silently adopt remote without
// prompting — there's nothing to lose.
function looksUntouched(payload: { transactions?: unknown[]; assignments?: object }) {
  const txs = payload.transactions ?? [];
  const assignmentMonths = payload.assignments
    ? Object.keys(payload.assignments).length
    : 0;
  return txs.length === 0 && assignmentMonths === 0;
}

export default function CloudSyncBridge() {
  const { user, status } = useAuth();
  const store = useHorizonStore();
  const {
    transactions,
    accounts,
    groups,
    assignments,
    pinnedCategoryIds,
    targets,
    plannerFolders,
    plannerBudgets,
    plannerEntries,
    scheduledTransactions,
    reconciliations,
    monthNotes,
    rules,
    settings,
    currentBudgetId,
    currentBudgetHouseholdId,
    exportBackup,
    restoreFromBackup,
  } = store;

  // Pick the per-user or household sync path based on whether the active
  // budget is linked to a household. The path string also doubles as the
  // dependency key — switching households re-runs the initial sync.
  const householdId = currentBudgetHouseholdId;

  const pull = householdId
    ? () => pullHouseholdBudget(householdId)
    : (uid: string) => pullBudget(uid, currentBudgetId);
  const push = householdId
    ? (payload: unknown) => pushHouseholdBudget(householdId, payload)
    : (payload: unknown) =>
        user ? pushBudget(user.uid, currentBudgetId, payload) : Promise.resolve();
  const subscribeFn = householdId
    ? (on: (d: CloudBudgetDoc) => void) =>
        subscribeHouseholdBudget(householdId, on)
    : (on: (d: CloudBudgetDoc) => void) =>
        user
          ? subscribeBudget(user.uid, currentBudgetId, on)
          : Promise.resolve(() => {});

  // Tracks the JSON we last pushed / pulled so we can skip redundant writes
  // and ignore subscription echoes of our own writes.
  const lastSyncedJsonRef = useRef<string | null>(null);
  // Once the initial sync completes for this (user, syncKey) pair we set
  // this so the debounced-push effect can start firing.
  const initialSyncDoneRef = useRef<{ uid: string; syncKey: string } | null>(
    null,
  );
  // Composite key — household budgets are the same across users; per-user
  // budgets are scoped to the user. Either way, switching keys resets sync.
  const syncKey = householdId ?? `user:${currentBudgetId}`;

  // Initial sync on sign-in (or budget switch / household join while signed in).
  useEffect(() => {
    if (status !== "signed-in" || !user || !currentBudgetId) {
      initialSyncDoneRef.current = null;
      lastSyncedJsonRef.current = null;
      return;
    }
    if (
      initialSyncDoneRef.current?.uid === user.uid &&
      initialSyncDoneRef.current?.syncKey === syncKey
    ) {
      return;
    }
    let cancelled = false;
    (async () => {
      const localPayload = exportBackup();
      const localJson = JSON.stringify(localPayload);
      const remote = await pull(user.uid);
      if (cancelled) return;
      if (!remote) {
        // First time this sync key has been seen — seed remote from local.
        try {
          await push(localPayload);
          lastSyncedJsonRef.current = localJson;
        } catch {
          /* swallow — surfaced via subsequent retry on next state change */
        }
        initialSyncDoneRef.current = { uid: user.uid, syncKey };
        return;
      }
      const remoteJson = JSON.stringify(remote.payload);
      if (remoteJson === localJson) {
        lastSyncedJsonRef.current = localJson;
        initialSyncDoneRef.current = { uid: user.uid, syncKey };
        return;
      }
      // Truly diverged. If local looks like a fresh install, adopt remote
      // silently. Otherwise ask the user — sign-in / household-join is a
      // deliberate action, a single prompt won't surprise them.
      const adoptRemote =
        looksUntouched(localPayload as { transactions?: unknown[]; assignments?: object }) ||
        window.confirm(
          [
            householdId
              ? "Cloud sync found a household budget different from this device."
              : "Cloud sync found a budget here different from this device.",
            "",
            "OK   → Use the cloud version (replace what's on this device)",
            "Cancel → Keep this device's data (push it to the cloud)",
          ].join("\n"),
        );
      if (adoptRemote) {
        restoreFromBackup(remote.payload as Parameters<typeof restoreFromBackup>[0]);
        lastSyncedJsonRef.current = remoteJson;
      } else {
        try {
          await push(localPayload);
          lastSyncedJsonRef.current = localJson;
        } catch {
          /* swallow */
        }
      }
      initialSyncDoneRef.current = { uid: user.uid, syncKey };
    })();
    return () => {
      cancelled = true;
    };
  }, [status, user, currentBudgetId, householdId, syncKey, exportBackup, restoreFromBackup]);

  // Debounced push on every state change once the initial sync has settled.
  useEffect(() => {
    if (status !== "signed-in" || !user || !currentBudgetId) return;
    if (
      initialSyncDoneRef.current?.uid !== user.uid ||
      initialSyncDoneRef.current?.syncKey !== syncKey
    ) {
      return;
    }
    const localPayload = exportBackup();
    const localJson = JSON.stringify(localPayload);
    if (localJson === lastSyncedJsonRef.current) return;
    const handle = window.setTimeout(async () => {
      try {
        await push(localPayload);
        lastSyncedJsonRef.current = localJson;
      } catch {
        /* let the next state change retry */
      }
    }, PUSH_DEBOUNCE_MS);
    return () => window.clearTimeout(handle);
  }, [
    status,
    user,
    currentBudgetId,
    householdId,
    syncKey,
    exportBackup,
    transactions,
    accounts,
    groups,
    assignments,
    pinnedCategoryIds,
    targets,
    plannerFolders,
    plannerBudgets,
    plannerEntries,
    scheduledTransactions,
    reconciliations,
    monthNotes,
    rules,
    settings,
  ]);

  // Live updates from other devices. Echoes of our own writes are filtered
  // by the lastSyncedJsonRef equality check.
  useEffect(() => {
    if (status !== "signed-in" || !user || !currentBudgetId) return;
    let cancelled = false;
    let unsubscribe: (() => void) | undefined;
    subscribeFn((remote) => {
      if (cancelled) return;
      const remoteJson = JSON.stringify(remote.payload);
      if (remoteJson === lastSyncedJsonRef.current) return;
      restoreFromBackup(remote.payload as Parameters<typeof restoreFromBackup>[0]);
      lastSyncedJsonRef.current = remoteJson;
    }).then((unsub) => {
      if (cancelled) unsub();
      else unsubscribe = unsub;
    });
    return () => {
      cancelled = true;
      if (unsubscribe) unsubscribe();
    };
  }, [status, user, currentBudgetId, householdId, syncKey, restoreFromBackup]);

  return null;
}
