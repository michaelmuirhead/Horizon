"use client";

// Per-device storage for the home-tab layout preference (which sections
// show up, what order, what's hidden). Stored in localStorage and
// deliberately NOT pushed to Firestore — household members each get
// their own home arrangement instead of sharing one.
//
// Older versions persisted the layout inside settings.homeSectionLayout
// which was cloud-synced. The HomePage + customize-home page fall back
// to that legacy field when the local store is empty, so an existing
// user's saved arrangement carries forward on first load and then
// migrates as soon as they touch the customize page.

import { useCallback, useEffect, useState } from "react";
import type { HomeSectionPreference } from "@/components/store/HorizonStore";

const STORAGE_KEY = "horizon-home-layout";

export function loadHomeLayout(): HomeSectionPreference[] | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return undefined;
    return parsed as HomeSectionPreference[];
  } catch {
    return undefined;
  }
}

export function saveHomeLayout(
  layout: HomeSectionPreference[] | undefined,
): void {
  if (typeof window === "undefined") return;
  try {
    if (layout === undefined || layout.length === 0) {
      localStorage.removeItem(STORAGE_KEY);
    } else {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(layout));
    }
  } catch {
    // ignore quota / SecurityError
  }
}

// Hook that reads the per-device layout on mount and exposes a setter
// that writes through to localStorage. The initial render returns
// `legacyFallback` so the home tab doesn't briefly snap from the saved
// arrangement to defaults — by the time useEffect runs the real value
// replaces it.
export function useHomeLayout(
  legacyFallback: HomeSectionPreference[] | undefined,
): {
  layout: HomeSectionPreference[] | undefined;
  setLayout: (next: HomeSectionPreference[] | undefined) => void;
} {
  const [layout, setInternal] = useState<HomeSectionPreference[] | undefined>(
    legacyFallback,
  );
  useEffect(() => {
    const stored = loadHomeLayout();
    if (stored !== undefined) {
      setInternal(stored);
    } else if (legacyFallback !== undefined) {
      // First load on this device for a user whose previous home layout
      // lived in synced settings — copy it down and start using the
      // per-device store from here on.
      saveHomeLayout(legacyFallback);
      setInternal(legacyFallback);
    }
    // legacyFallback is read once on mount; subsequent settings changes
    // shouldn't clobber the per-device layout.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setLayout = useCallback(
    (next: HomeSectionPreference[] | undefined) => {
      setInternal(next);
      saveHomeLayout(next);
    },
    [],
  );

  return { layout, setLayout };
}
