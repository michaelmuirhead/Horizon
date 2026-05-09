// Last-writer-wins sync helpers. Two access patterns:
//
//  • Per-user budget at users/{uid}/budgets/{budgetId} — the default for
//    a single signed-in user syncing their own data across devices.
//  • Shared household budget at households/{hid}/budget/state with
//    membership controlled via households/{hid}.memberUids and an invite
//    flow through joinCodes/{code}.
//
// Both shapes carry the same { payload, updatedAt, schemaVersion } body.
// Writes are client-stamped (Date.now()); fine for a single user editing
// on one device at a time, not a CRDT — schemaVersion lets us evolve.

import { getFirebase } from "./firebase";

export const SCHEMA_VERSION = 2;

export type CloudBudgetDoc = {
  payload: unknown;
  updatedAt: number;
  schemaVersion: number;
};

function userBudgetPath(uid: string, budgetId: string): [string, string, string, string] {
  return ["users", uid, "budgets", budgetId];
}

function householdBudgetPath(
  householdId: string,
): [string, string, string, string] {
  // Sub-collection so member-only access inherits from the parent
  // household doc's `match /{document=**}` rule.
  return ["households", householdId, "budget", "state"];
}

function householdPath(householdId: string): [string, string] {
  return ["households", householdId];
}

function joinCodePath(code: string): [string, string] {
  return ["joinCodes", code];
}

// ─── Per-user budget ────────────────────────────────────────────────────

export async function pushBudget(
  uid: string,
  budgetId: string,
  payload: unknown,
): Promise<void> {
  const handles = await getFirebase();
  if (!handles) return;
  const { doc, setDoc } = await import("firebase/firestore");
  const ref = doc(handles.db, ...userBudgetPath(uid, budgetId));
  const body: CloudBudgetDoc = {
    payload,
    updatedAt: Date.now(),
    schemaVersion: SCHEMA_VERSION,
  };
  await setDoc(ref, body);
}

export async function pullBudget(
  uid: string,
  budgetId: string,
): Promise<CloudBudgetDoc | null> {
  const handles = await getFirebase();
  if (!handles) return null;
  const { doc, getDoc } = await import("firebase/firestore");
  const ref = doc(handles.db, ...userBudgetPath(uid, budgetId));
  const snap = await getDoc(ref);
  return readDoc(snap);
}

export async function subscribeBudget(
  uid: string,
  budgetId: string,
  onUpdate: (doc: CloudBudgetDoc) => void,
): Promise<() => void> {
  const handles = await getFirebase();
  if (!handles) return () => {};
  const { doc, onSnapshot } = await import("firebase/firestore");
  const ref = doc(handles.db, ...userBudgetPath(uid, budgetId));
  return onSnapshot(ref, (snap) => {
    const data = readDoc(snap);
    if (data) onUpdate(data);
  });
}

// ─── Household budget ───────────────────────────────────────────────────

export async function pushHouseholdBudget(
  householdId: string,
  payload: unknown,
): Promise<void> {
  const handles = await getFirebase();
  if (!handles) return;
  const { doc, setDoc } = await import("firebase/firestore");
  const ref = doc(handles.db, ...householdBudgetPath(householdId));
  const body: CloudBudgetDoc = {
    payload,
    updatedAt: Date.now(),
    schemaVersion: SCHEMA_VERSION,
  };
  await setDoc(ref, body);
}

export async function pullHouseholdBudget(
  householdId: string,
): Promise<CloudBudgetDoc | null> {
  const handles = await getFirebase();
  if (!handles) return null;
  const { doc, getDoc } = await import("firebase/firestore");
  const ref = doc(handles.db, ...householdBudgetPath(householdId));
  const snap = await getDoc(ref);
  return readDoc(snap);
}

export async function subscribeHouseholdBudget(
  householdId: string,
  onUpdate: (doc: CloudBudgetDoc) => void,
): Promise<() => void> {
  const handles = await getFirebase();
  if (!handles) return () => {};
  const { doc, onSnapshot } = await import("firebase/firestore");
  const ref = doc(handles.db, ...householdBudgetPath(householdId));
  return onSnapshot(ref, (snap) => {
    const data = readDoc(snap);
    if (data) onUpdate(data);
  });
}

// ─── Household + join-code lifecycle ────────────────────────────────────

// Generates a 12-char invite code. Lowercase + digits so it transcribes
// cleanly between devices ("typed it into my phone").
function freshJoinCode(): string {
  const raw =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2);
  return raw.replace(/-/g, "").slice(0, 12).toLowerCase();
}

// Creates a household owned by `uid` with `uid` as the only member, plus
// a fresh join code pointing at it. Returns both ids so the caller can
// share the code and start syncing against the household.
export async function createHousehold(
  uid: string,
): Promise<{ householdId: string; joinCode: string } | null> {
  const handles = await getFirebase();
  if (!handles) return null;
  const { collection, doc, setDoc } = await import("firebase/firestore");
  const householdId = doc(collection(handles.db, "households")).id;
  await setDoc(doc(handles.db, ...householdPath(householdId)), {
    ownerUid: uid,
    memberUids: [uid],
  });
  const joinCode = freshJoinCode();
  await setDoc(doc(handles.db, ...joinCodePath(joinCode)), {
    householdId,
  });
  return { householdId, joinCode };
}

// Reads joinCodes/{code} → returns the householdId it points at, or null
// if the code is unknown / malformed.
export async function resolveJoinCode(
  code: string,
): Promise<string | null> {
  const handles = await getFirebase();
  if (!handles) return null;
  const { doc, getDoc } = await import("firebase/firestore");
  const ref = doc(handles.db, ...joinCodePath(code.trim().toLowerCase()));
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  const data = snap.data() as { householdId?: unknown };
  return typeof data.householdId === "string" ? data.householdId : null;
}

// Adds `uid` to households/{householdId}.memberUids. Firestore rules
// allow this for non-members ONLY when the request is just adding
// request.auth.uid to memberUids — which is exactly what arrayUnion(uid)
// generates here.
export async function joinHousehold(
  householdId: string,
  uid: string,
): Promise<void> {
  const handles = await getFirebase();
  if (!handles) return;
  const { arrayUnion, doc, updateDoc } = await import("firebase/firestore");
  await updateDoc(doc(handles.db, ...householdPath(householdId)), {
    memberUids: arrayUnion(uid),
  });
}

// Mirror of joinHousehold for leaving. The rules let any member update
// memberUids freely, so removing your own uid is allowed.
export async function leaveHousehold(
  householdId: string,
  uid: string,
): Promise<void> {
  const handles = await getFirebase();
  if (!handles) return;
  const { arrayRemove, doc, updateDoc } = await import("firebase/firestore");
  await updateDoc(doc(handles.db, ...householdPath(householdId)), {
    memberUids: arrayRemove(uid),
  });
}

// ─── Internal ───────────────────────────────────────────────────────────

function readDoc(
  snap: import("firebase/firestore").DocumentSnapshot,
): CloudBudgetDoc | null {
  if (!snap.exists()) return null;
  const data = snap.data();
  if (
    !data ||
    typeof data !== "object" ||
    typeof (data as CloudBudgetDoc).updatedAt !== "number"
  ) {
    return null;
  }
  return data as CloudBudgetDoc;
}
