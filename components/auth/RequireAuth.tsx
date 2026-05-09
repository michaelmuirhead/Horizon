"use client";

import { type ReactNode } from "react";
import { Cloud, LockKeyhole } from "lucide-react";
import { useAuth } from "@/components/auth/AuthContext";

// Gates the main app behind a Google sign-in. When the user isn't yet
// signed in we render an inline sign-in screen instead of the children
// — no redirect bounce, no flash of authenticated UI. The four AuthContext
// states map cleanly:
//
//   loading       → centred spinner placeholder
//   unconfigured  → "cloud sync isn't configured" screen (build issue)
//   signed-out    → branded sign-in screen with the Google button
//   signed-in     → render children (the real app)
export default function RequireAuth({ children }: { children: ReactNode }) {
  const { status, signIn, error } = useAuth();

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
  return (
    <div className="grid min-h-[100dvh] place-items-center bg-page px-6">
      <div className="w-full max-w-sm text-center">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-accent/15 text-accent">
          <LockKeyhole size={26} strokeWidth={2.2} />
        </div>
        <h1 className="mt-5 text-3xl font-extrabold">Welcome to Horizon</h1>
        <p className="mt-2 text-sm text-fg/70">
          Sign in to sync your budget across every device.
        </p>
        <button
          type="button"
          onClick={() => signIn()}
          className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full bg-accent px-6 py-3.5 text-base font-bold text-page"
        >
          Sign in with Google
        </button>
        {error && (
          <p className="mt-3 text-xs text-rose-400" role="alert">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
