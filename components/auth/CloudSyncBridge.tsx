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

export default function CloudSyncBridge() {
  const { user, status } = useAuth();
  const {
    lastModifiedAt,
    currentBudgetId,
    currentBudgetHouseholdId,
    exportBackup,
    restoreFromBackup,
  } = useHorizonStore();

  // Pick the per-user or household sync path based on whether the active
  // budget is linked to a household. The path string also doubles as the
  // dependency key — switching households re-runs the initial sync.
  const householdId = currentBudgetHouseholdId;
  const syncKey = householdId ?? `user:${currentBudgetId}`;

  const pull = householdId
    ? () => pullHouseholdBudget(householdId)
    : (uid: string) => pullBudget(uid, currentBudgetId);
  // Stamp the cloud doc with the local `lastModifiedAt` (when known) so
  // local + remote stamps stay byte-equal across reloads. Without this the
  // cloud's updatedAt would drift slightly past local, and every reload
  // would adopt-remote on identical data.
  const push = householdId
    ? (payload: unknown, updatedAt?: number) =>
        pushHouseholdBudget(householdId, payload, updatedAt)
    : (payload: unknown, updatedAt?: number) =>
        user
          ? pushBudget(user.uid, currentBudgetId, payload, updatedAt)
          : Promise.resolve();
  const subscribeFn = householdId
    ? (on: (d: CloudBudgetDoc) => void) =>
        subscribeHouseholdBudget(householdId, on)
    : (on: (d: CloudBudgetDoc) => void) =>
        user
          ? subscribeBudget(user.uid, currentBudgetId, on)
          : Promise.resolve(() => {});

  // The cloud doc's `updatedAt` we last observed. Lets the live subscription
  // filter out echoes of our own writes — anything <= this stamp came from
  // (or is identical to) what we just pushed.
  const lastSyncedAtRef = useRef<number>(0);
  // Once the initial sync completes for this (user, syncKey) pair we set
  // this so the debounced-push effect can start firing.
  const initialSyncDoneRef = useRef<{ uid: string; syncKey: string } | null>(
    null,
  );

  // Initial sync on sign-in (or budget switch / household join while signed in).
  // Last-writer-wins: compare the cloud doc's `updatedAt` against the local
  // `lastModifiedAt` stamp the store maintains, and adopt whichever is newer.
  // No user prompt — sign-in shouldn't make the user babysit a dialog.
  useEffect(() => {
    if (status !== "signed-in" || !user || !currentBudgetId) {
      initialSyncDoneRef.current = null;
      lastSyncedAtRef.current = 0;
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
      const localStamp =
        typeof localPayload.lastModifiedAt === "number"
          ? localPayload.lastModifiedAt
          : 0;
      const remote = await pull(user.uid);
      if (cancelled) return;
      if (!remote) {
        // First time this sync key has been seen — seed remote from local.
        try {
          await push(localPayload, localStamp || Date.now());
          lastSyncedAtRef.current = localStamp || Date.now();
        } catch {
          /* swallow — retry on next state change */
        }
        initialSyncDoneRef.current = { uid: user.uid, syncKey };
        return;
      }
      if (remote.updatedAt > localStamp) {
        // Cloud is newer — adopt it. restoreFromBackup picks up the cloud's
        // lastModifiedAt so subsequent comparisons stay aligned.
        restoreFromBackup(
          remote.payload as Parameters<typeof restoreFromBackup>[0],
        );
        lastSyncedAtRef.current = remote.updatedAt;
      } else if (localStamp > remote.updatedAt) {
        try {
          await push(localPayload, localStamp);
          lastSyncedAtRef.current = localStamp;
        } catch {
          /* swallow */
        }
      } else {
        // Same vintage — nothing to do, just record the stamp so the live
        // subscription can filter echoes.
        lastSyncedAtRef.current = remote.updatedAt;
      }
      initialSyncDoneRef.current = { uid: user.uid, syncKey };
    })();
    return () => {
      cancelled = true;
    };
  }, [status, user, currentBudgetId, householdId, syncKey, exportBackup, restoreFromBackup]);

  // Debounced push on every local mutation once the initial sync has settled.
  // Triggered by `lastModifiedAt` rather than each individual state slice so
  // we can't accidentally miss a slice and stop syncing it.
  useEffect(() => {
    if (status !== "signed-in" || !user || !currentBudgetId) return;
    if (
      initialSyncDoneRef.current?.uid !== user.uid ||
      initialSyncDoneRef.current?.syncKey !== syncKey
    ) {
      return;
    }
    if (lastModifiedAt <= lastSyncedAtRef.current) return;
    const handle = window.setTimeout(async () => {
      try {
        await push(exportBackup(), lastModifiedAt);
        lastSyncedAtRef.current = lastModifiedAt;
      } catch {
        /* let the next mutation retry */
      }
    }, PUSH_DEBOUNCE_MS);
    return () => window.clearTimeout(handle);
  }, [
    status,
    user,
    currentBudgetId,
    householdId,
    syncKey,
    lastModifiedAt,
    exportBackup,
  ]);

  // Live updates from other devices. Echoes of our own writes are filtered
  // by the `updatedAt <= lastSyncedAtRef` check.
  useEffect(() => {
    if (status !== "signed-in" || !user || !currentBudgetId) return;
    let cancelled = false;
    let unsubscribe: (() => void) | undefined;
    subscribeFn((remote) => {
      if (cancelled) return;
      if (remote.updatedAt <= lastSyncedAtRef.current) return;
      restoreFromBackup(
        remote.payload as Parameters<typeof restoreFromBackup>[0],
      );
      lastSyncedAtRef.current = remote.updatedAt;
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
