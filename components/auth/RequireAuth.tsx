"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { Cloud, LockKeyhole, Mail } from "lucide-react";
import { useAuth } from "@/components/auth/AuthContext";

// Gates the main app behind email + password sign-in. When the user isn't
// yet signed in we render an inline sign-in screen instead of the children —
// no redirect bounce, no flash of authenticated UI. The four AuthContext
// states map cleanly:
//
//   loading       → centred spinner placeholder
//   unconfigured  → "cloud sync isn't configured" screen (build issue)
//   signed-out    → sign-up / sign-in form
//   signed-in     → render children (the real app)
export default function RequireAuth({ children }: { children: ReactNode }) {
  const {
    status,
    signInWithEmail,
    signUpWithEmail,
    resetPassword,
    error,
    clearError,
  } = useAuth();

  // Default to "signup" — the app is now email/password only, so most
  // landing visitors will need to make an account first. Returning users
  // tap the toggle to switch into sign-in mode.
  const [mode, setMode] = useState<"signin" | "signup">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [info, setInfo] = useState<string | null>(null);

  if (status === "signed-in") return <>{children}</>;

  if (status === "loading") {
    return (
      <div className="grid min-h-[100dvh] place-items-center bg-page">
        <p className="text-sm text-fg/55">Loading…</p>
      </div>
    );
  }

  if (status === "unconfigured") {
    return (
      <div className="grid min-h-[100dvh] place-items-center bg-page px-6">
        <div className="max-w-sm text-center">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-card">
            <Cloud size={22} className="text-fg/60" strokeWidth={2.2} />
          </div>
          <h1 className="mt-4 text-2xl font-extrabold">
            Cloud sync isn&apos;t configured
          </h1>
          <p className="mt-3 text-sm text-fg/70">
            Horizon couldn&apos;t find Firebase credentials. Set the{" "}
            <code className="font-mono text-fg/85">
              NEXT_PUBLIC_FIREBASE_*
            </code>{" "}
            env vars and redeploy — the app needs them to sign you in.
          </p>
        </div>
      </div>
    );
  }

  // signed-out
  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setInfo(null);
    clearError();
    if (!email || !password) return;
    setSubmitting(true);
    try {
      if (mode === "signup") {
        await signUpWithEmail(email, password);
      } else {
        await signInWithEmail(email, password);
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleReset() {
    setInfo(null);
    clearError();
    if (!email) {
      setInfo("Enter your email above first, then tap Reset password.");
      return;
    }
    await resetPassword(email);
    setInfo(`If an account exists for ${email}, a reset link is on its way.`);
  }

  const isSignup = mode === "signup";

  return (
    <div className="grid min-h-[100dvh] place-items-center bg-page px-6 py-10">
      <div className="w-full max-w-sm text-center">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-accent/15 text-accent">
          <LockKeyhole size={26} strokeWidth={2.2} />
        </div>
        <h1 className="mt-5 text-3xl font-extrabold">
          {isSignup ? "Create your Horizon account" : "Welcome back"}
        </h1>
        <p className="mt-2 text-sm text-fg/70">
          {isSignup
            ? "Sign up with an email and password to sync your budget across every device."
            : "Sign in with your email and password to pick up where you left off."}
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-3 text-left">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-fg/70">
              Email
            </span>
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-fg/15 bg-card px-3.5 py-2.5 text-sm outline-none focus:border-accent"
              placeholder="you@example.com"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-fg/70">
              Password
            </span>
            <input
              type="password"
              autoComplete={isSignup ? "new-password" : "current-password"}
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-fg/15 bg-card px-3.5 py-2.5 text-sm outline-none focus:border-accent"
              placeholder={
                isSignup ? "At least 6 characters" : "Your password"
              }
            />
          </label>

          <button
            type="submit"
            disabled={submitting}
            className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-accent px-6 py-3.5 text-base font-bold text-page disabled:opacity-60"
          >
            <Mail size={18} strokeWidth={2.4} />
            {submitting
              ? isSignup
                ? "Creating account…"
                : "Signing in…"
              : isSignup
                ? "Create account"
                : "Sign in"}
          </button>
        </form>

        <div className="mt-4 flex items-center justify-between text-xs text-fg/65">
          <button
            type="button"
            onClick={() => {
              setMode(isSignup ? "signin" : "signup");
              clearError();
              setInfo(null);
            }}
            className="underline-offset-2 hover:underline"
          >
            {isSignup
              ? "Already have an account? Sign in"
              : "New here? Create an account"}
          </button>
          {!isSignup && (
            <button
              type="button"
              onClick={handleReset}
              className="underline-offset-2 hover:underline"
            >
              Reset password
            </button>
          )}
        </div>

        {error && (
          <p className="mt-3 text-xs text-rose-400" role="alert">
            {error}
          </p>
        )}
        {info && !error && (
          <p className="mt-3 text-xs text-fg/65" role="status">
            {info}
          </p>
        )}

        <p className="mt-6 text-[11px] text-fg/45">
          Your budget is stored privately in Firebase under your account.
        </p>
      </div>
    </div>
  );
}
