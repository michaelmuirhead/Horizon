"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { getFirebase, isFirebaseConfigured } from "@/lib/firebase";

export type AuthUser = {
  uid: string;
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
};

type Status = "unconfigured" | "loading" | "signed-out" | "signed-in";

type Ctx = {
  user: AuthUser | null;
  status: Status;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  error: string | null;
};

const AuthContext = createContext<Ctx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const configured = useMemo(() => isFirebaseConfigured(), []);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [status, setStatus] = useState<Status>(
    configured ? "loading" : "unconfigured",
  );
  const [error, setError] = useState<string | null>(null);

  // Subscribe to auth changes once Firebase is loaded. We dynamic-import
  // it inside the effect so the SDK only joins the bundle when actually
  // needed (matches the lazy init in lib/firebase.ts).
  useEffect(() => {
    if (!configured) return;
    let unsubscribe: (() => void) | null = null;
    let cancelled = false;
    (async () => {
      const handles = await getFirebase();
      if (!handles || cancelled) return;
      const { onAuthStateChanged } = await import("firebase/auth");
      unsubscribe = onAuthStateChanged(handles.auth, (fbUser) => {
        if (cancelled) return;
        if (!fbUser) {
          setUser(null);
          setStatus("signed-out");
          return;
        }
        setUser({
          uid: fbUser.uid,
          displayName: fbUser.displayName,
          email: fbUser.email,
          photoURL: fbUser.photoURL,
        });
        setStatus("signed-in");
      });
    })();
    return () => {
      cancelled = true;
      if (unsubscribe) unsubscribe();
    };
  }, [configured]);

  const signIn = useCallback(async () => {
    setError(null);
    const handles = await getFirebase();
    if (!handles) {
      setError("Cloud sync isn't configured for this app.");
      return;
    }
    try {
      const { GoogleAuthProvider, signInWithPopup } = await import(
        "firebase/auth"
      );
      const provider = new GoogleAuthProvider();
      await signInWithPopup(handles.auth, provider);
    } catch (e: unknown) {
      // Common cases: user closed the popup, or third-party cookies are
      // blocked. We swallow the cancellation case quietly.
      const code = (e as { code?: string }).code ?? "";
      if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") {
        return;
      }
      setError(
        (e as { message?: string }).message ?? "Sign-in failed.",
      );
    }
  }, []);

  const signOut = useCallback(async () => {
    const handles = await getFirebase();
    if (!handles) return;
    const { signOut: fbSignOut } = await import("firebase/auth");
    await fbSignOut(handles.auth);
  }, []);

  const value = useMemo<Ctx>(
    () => ({ user, status, signIn, signOut, error }),
    [user, status, signIn, signOut, error],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): Ctx {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
