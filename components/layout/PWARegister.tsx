"use client";

import { useEffect, useState } from "react";

export default function PWARegister() {
  // Set when the SW has an update sitting in `waiting`. Surfacing it
  // lets the user choose when to reload instead of being yanked out of
  // whatever they're typing.
  const [waitingWorker, setWaitingWorker] =
    useState<ServiceWorker | null>(null);
  const [reloading, setReloading] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV !== "production") return;

    let intervalId: number | undefined;
    let registration: ServiceWorkerRegistration | undefined;

    // Reload once the new SW takes control. We only ever trigger this
    // path after the user opts in via the banner, so there's no risk of
    // clobbering an in-progress edit.
    function onControllerChange() {
      if (reloading) return;
      setReloading(true);
      window.location.reload();
    }

    function trackWaiting(reg: ServiceWorkerRegistration) {
      if (reg.waiting && navigator.serviceWorker.controller) {
        setWaitingWorker(reg.waiting);
      }
    }

    function watchInstalling(reg: ServiceWorkerRegistration) {
      const newWorker = reg.installing;
      if (!newWorker) return;
      newWorker.addEventListener("statechange", () => {
        if (
          newWorker.state === "installed" &&
          navigator.serviceWorker.controller
        ) {
          setWaitingWorker(newWorker);
        }
      });
    }

    function register() {
      navigator.serviceWorker
        // updateViaCache: "none" tells the browser not to use its HTTP cache
        // for the SW script itself. Without it the SW can be served stale
        // from cache for up to 24h, which is the main reason a "fresh"
        // install seemed required to pick up new code.
        .register("/sw.js", { updateViaCache: "none" })
        .then((reg) => {
          registration = reg;
          // If we registered AFTER the new SW already finished installing
          // (e.g. tab was backgrounded), surface it immediately.
          trackWaiting(reg);
          // Otherwise watch for the next install to finish.
          reg.addEventListener("updatefound", () => watchInstalling(reg));
          // Re-check for an updated SW when the user comes back to the tab
          // and once an hour while it's open. Browsers do this on their own
          // schedule but the cadence is generous; nudging it is cheap.
          const checkForUpdate = () => {
            reg.update().catch(() => {});
          };
          window.addEventListener("focus", checkForUpdate);
          intervalId = window.setInterval(checkForUpdate, 60 * 60 * 1000);
        })
        .catch(() => {
          /* swallow registration errors */
        });
    }

    navigator.serviceWorker.addEventListener(
      "controllerchange",
      onControllerChange,
    );

    if (document.readyState === "complete") {
      register();
    } else {
      window.addEventListener("load", register, { once: true });
    }

    return () => {
      navigator.serviceWorker.removeEventListener(
        "controllerchange",
        onControllerChange,
      );
      if (intervalId !== undefined) window.clearInterval(intervalId);
    };
  }, [reloading]);

  if (!waitingWorker || reloading) return null;

  return (
    <div
      role="status"
      className="fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+96px)] z-40 mx-auto flex max-w-md items-center justify-between gap-3 rounded-2xl border border-accent/40 bg-accent/15 px-4 py-3 text-sm font-bold text-accent backdrop-blur md:max-w-md"
      style={{ width: "calc(100% - 2rem)" }}
    >
      <span>A new version is available.</span>
      <button
        type="button"
        onClick={() => {
          waitingWorker.postMessage({ type: "SKIP_WAITING" });
        }}
        className="rounded-full bg-accent px-3 py-1.5 text-xs font-bold text-page"
      >
        Reload
      </button>
    </div>
  );
}
