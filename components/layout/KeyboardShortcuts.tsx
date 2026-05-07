"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const NAV: { key: string; href: string; label: string }[] = [
  { key: "h", href: "/", label: "Home" },
  { key: "b", href: "/budget", label: "Budget" },
  { key: "s", href: "/spending", label: "Spending" },
  { key: "a", href: "/accounts", label: "Accounts" },
  { key: "r", href: "/reflect", label: "Reflect" },
  { key: "p", href: "/planner", label: "Planner" },
];

const ACTIONS: { keys: string; href: string; label: string }[] = [
  { keys: "n", href: "/spending/new", label: "New transaction" },
  { keys: "t", href: "/spending/transfer", label: "New transfer" },
  { keys: "g", href: "/goal/new", label: "New / edit target" },
  { keys: ",", href: "/settings", label: "Settings" },
];

function isEditableTarget(t: EventTarget | null): boolean {
  if (!(t instanceof HTMLElement)) return false;
  const tag = t.tagName.toLowerCase();
  if (tag === "input" || tag === "textarea" || tag === "select") return true;
  if (t.isContentEditable) return true;
  return false;
}

export default function KeyboardShortcuts() {
  const router = useRouter();
  const [helpOpen, setHelpOpen] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      // Ignore when the user is typing in a field or holding modifier combos.
      if (isEditableTarget(e.target)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.key === "?" || (e.key === "/" && e.shiftKey)) {
        e.preventDefault();
        setHelpOpen((v) => !v);
        return;
      }
      if (e.key === "Escape" && helpOpen) {
        setHelpOpen(false);
        return;
      }
      const lower = e.key.toLowerCase();
      const navHit = NAV.find((n) => n.key === lower);
      if (navHit) {
        e.preventDefault();
        router.push(navHit.href);
        return;
      }
      const actionHit = ACTIONS.find((a) => a.keys === lower);
      if (actionHit) {
        e.preventDefault();
        router.push(actionHit.href);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router, helpOpen]);

  if (!helpOpen) return null;

  return (
    <div
      role="dialog"
      aria-label="Keyboard shortcuts"
      onClick={() => setHelpOpen(false)}
      className="fixed inset-0 z-50 grid place-items-center bg-black/60 px-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-2xl bg-card-elevated p-5 ring-1 ring-fg/10"
      >
        <h2 className="text-base font-bold">Keyboard shortcuts</h2>
        <p className="mt-1 text-xs text-fg/55">
          Press a key to jump. Skipped when you&rsquo;re typing in a field.
        </p>
        <div className="mt-4 space-y-3">
          <section>
            <p className="text-[11px] font-bold uppercase tracking-wide text-fg/55">
              Navigate
            </p>
            <ul className="mt-1 space-y-1 text-sm">
              {NAV.map((n) => (
                <li key={n.key} className="flex items-center justify-between">
                  <span>{n.label}</span>
                  <kbd className="rounded bg-card px-2 py-0.5 text-xs font-bold">
                    {n.key}
                  </kbd>
                </li>
              ))}
            </ul>
          </section>
          <section>
            <p className="text-[11px] font-bold uppercase tracking-wide text-fg/55">
              Actions
            </p>
            <ul className="mt-1 space-y-1 text-sm">
              {ACTIONS.map((a) => (
                <li
                  key={a.keys}
                  className="flex items-center justify-between"
                >
                  <span>{a.label}</span>
                  <kbd className="rounded bg-card px-2 py-0.5 text-xs font-bold">
                    {a.keys}
                  </kbd>
                </li>
              ))}
              <li className="flex items-center justify-between">
                <span>Toggle this help</span>
                <kbd className="rounded bg-card px-2 py-0.5 text-xs font-bold">
                  ?
                </kbd>
              </li>
            </ul>
          </section>
        </div>
        <button
          type="button"
          onClick={() => setHelpOpen(false)}
          className="mt-5 w-full rounded-full bg-card px-4 py-2 text-sm font-bold"
        >
          Close
        </button>
      </div>
    </div>
  );
}
