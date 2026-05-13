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
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
  error: string | null;
  clearError: () => void;
};

const AuthContext = createContext<Ctx | null>(null);

// Translates a raw Firebase auth error into something a person can read.
// We keep this small and only cover the codes that surface in the email +
// password flows we expose.
function friendlyAuthError(e: unknown): string {
  const code = (e as { code?: string }).code ?? "";
  switch (code) {
    case "auth/invalid-email":
      return "That email address doesn't look right.";
    case "auth/user-disabled":
      return "This account has been disabled.";
    case "auth/user-not-found":
    case "auth/wrong-password":
    case "auth/invalid-credential":
      return "Email or password is incorrect.";
    case "auth/email-already-in-use":
      return "An account with that email already exists. Try signing in.";
    case "auth/weak-password":
      return "Password is too weak. Use at least 6 characters.";
    case "auth/missing-password":
      return "Please enter a password.";
    case "auth/too-many-requests":
      return "Too many attempts. Wait a moment and try again.";
    case "auth/network-request-failed":
      return "Network error. Check your connection and try again.";
    case "auth/operation-not-allowed":
      return "Email/password sign-in isn't enabled for this app yet. Turn it on in the Firebase console.";
    case "auth/unauthorized-domain":
      return "This domain isn't authorized for sign-in. Add it in the Firebase console.";
    case "auth/api-key-not-valid.-please-pass-a-valid-api-key.":
    case "auth/api-key-not-valid":
      return "Sign-in is misconfigured (invalid API key). Check Firebase env vars and Google Cloud key restrictions.";
    default:
      return (e as { message?: string }).message ?? "Sign-in failed.";
  }
}

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

  const signInWithEmail = useCallback(
    async (email: string, password: string) => {
      setError(null);
      const handles = await getFirebase();
      if (!handles) {
        setError("Cloud sync isn't configured for this app.");
        return;
      }
      try {
        const { signInWithEmailAndPassword } = await import("firebase/auth");
        await signInWithEmailAndPassword(handles.auth, email.trim(), password);
      } catch (e: unknown) {
        setError(friendlyAuthError(e));
      }
    },
    [],
  );

  const signUpWithEmail = useCallback(
    async (email: string, password: string) => {
      setError(null);
      const handles = await getFirebase();
      if (!handles) {
        setError("Cloud sync isn't configured for this app.");
        return;
      }
      try {
        const { createUserWithEmailAndPassword } = await import(
          "firebase/auth"
        );
        await createUserWithEmailAndPassword(
          handles.auth,
          email.trim(),
          password,
        );
      } catch (e: unknown) {
        setError(friendlyAuthError(e));
      }
    },
    [],
  );

  const resetPassword = useCallback(async (email: string) => {
    setError(null);
    const handles = await getFirebase();
    if (!handles) {
      setError("Cloud sync isn't configured for this app.");
      return;
    }
    try {
      const { sendPasswordResetEmail } = await import("firebase/auth");
      await sendPasswordResetEmail(handles.auth, email.trim());
    } catch (e: unknown) {
      setError(friendlyAuthError(e));
    }
  }, []);

  const signOut = useCallback(async () => {
    const handles = await getFirebase();
    if (!handles) return;
    const { signOut: fbSignOut } = await import("firebase/auth");
    await fbSignOut(handles.auth);
  }, []);

  const clearError = useCallback(() => setError(null), []);

  const value = useMemo<Ctx>(
    () => ({
      user,
      status,
      signInWithEmail,
      signUpWithEmail,
      resetPassword,
      signOut,
      error,
      clearError,
    }),
    [
      user,
      status,
      signInWithEmail,
      signUpWithEmail,
      resetPassword,
      signOut,
      error,
      clearError,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): Ctx {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
