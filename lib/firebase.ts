// Lazy-initialised Firebase singleton. We dynamic-import the SDK so the
// ~150KB of client code only joins the bundle when the user actually opts
// into Cloud Sync — the local-only path stays lean.
//
// Returns null when env vars are missing so the rest of the app can render
// the Cloud Sync UI conditionally without try/catch noise.

import type { FirebaseApp } from "firebase/app";
import type { Auth } from "firebase/auth";
import type { Firestore } from "firebase/firestore";

type FirebaseHandles = {
  app: FirebaseApp;
  auth: Auth;
  db: Firestore;
};

let cached: FirebaseHandles | null | undefined;

type ResolvedConfig = {
  apiKey: string;
  projectId: string;
  authDomain?: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId?: string;
};

function readConfig(): ResolvedConfig | null {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  // The two values we *must* have to do anything useful. The rest are
  // either optional or only matter for specific sub-products we're not
  // using yet.
  if (!apiKey || !projectId) return null;
  return {
    apiKey,
    projectId,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  };
}

export function isFirebaseConfigured(): boolean {
  return readConfig() !== null;
}

export async function getFirebase(): Promise<FirebaseHandles | null> {
  if (cached !== undefined) return cached;
  const cfg = readConfig();
  if (!cfg) {
    cached = null;
    return null;
  }
  const [{ initializeApp, getApps, getApp }, { getAuth }, { getFirestore }] =
    await Promise.all([
      import("firebase/app"),
      import("firebase/auth"),
      import("firebase/firestore"),
    ]);
  const app = getApps().length === 0 ? initializeApp(cfg) : getApp();
  const auth = getAuth(app);
  const db = getFirestore(app);
  cached = { app, auth, db };
  return cached;
}
