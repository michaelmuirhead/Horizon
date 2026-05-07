"use client";

import { useEffect } from "react";

export default function PWARegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV !== "production") return;

    // Whether the page already had a controlling SW at register time.
    // We use this to distinguish a real update (controllerchange after we
    // had a controller) from the first install (controllerchange because
    // clients.claim() just took control mid-load) — only the first case
    // should trigger a reload.
    const hadController = !!navigator.serviceWorker.controller;
    let reloading = false;
    let intervalId: number | undefined;

    function onControllerChange() {
      if (!hadController) return;
      if (reloading) return;
      reloading = true;
      window.location.reload();
    }

    function register() {
      navigator.serviceWorker
        // updateViaCache: "none" tells the browser not to use its HTTP cache
        // for the SW script itself. Without it the SW can be served stale
        // from cache for up to 24h, which is the main reason a "fresh"
        // install seemed required to pick up new code.
        .register("/sw.js", { updateViaCache: "none" })
        .then((registration) => {
          // Re-check for an updated SW when the user comes back to the tab
          // and once an hour while it's open. Browsers do this on their own
          // schedule but the cadence is generous; nudging it is cheap.
          const checkForUpdate = () => {
            registration.update().catch(() => {});
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
  }, []);

  return null;
}
