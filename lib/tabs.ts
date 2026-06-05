"use client";

// Canonical list of primary tabs and a per-device store for the
// "which tabs do I want to see" preference. Hidden tabs are stripped
// from the bottom nav / left rail but their routes still exist —
// keyboard shortcuts and deep links keep working, so this is a UX
// decluttering switch, not a feature kill switch.
//
// Stored in localStorage (like homeLayoutStore) so household members
// who share an account can each strip the app down differently. The
// stored value is just an array of tab ids that should be hidden.

import {
  BarChart3,
  Banknote,
  BookOpen,
  CalendarClock,
  Home,
  Landmark,
  type LucideIcon,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";

export type TabId =
  | "home"
  | "budget"
  | "spending"
  | "accounts"
  | "reflect"
  | "fudget";

export type TabDef = {
  id: TabId;
  href: string;
  label: string;
  icon: LucideIcon;
};

// Display order is the rendering order in the nav.
export const TABS: readonly TabDef[] = [
  { id: "home", href: "/", label: "Home", icon: Home },
  { id: "budget", href: "/budget", label: "Budget", icon: BookOpen },
  { id: "spending", href: "/spending", label: "Spending", icon: Banknote },
  { id: "accounts", href: "/accounts", label: "Accounts", icon: Landmark },
  { id: "reflect", href: "/reflect", label: "Reflect", icon: BarChart3 },
  { id: "fudget", href: "/planner", label: "Fudget", icon: CalendarClock },
];

export function visibleTabs(hidden: readonly TabId[]): TabDef[] {
  const hide = new Set(hidden);
  return TABS.filter((t) => !hide.has(t.id));
}

// ─── Per-device hidden-tab preference ───────────────────────────────────

const STORAGE_KEY = "horizon-hidden-tabs-v1";
const VALID_IDS = new Set<TabId>(TABS.map((t) => t.id));

function parseStored(raw: string | null): TabId[] | undefined {
  if (raw === null) return undefined;
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return undefined;
    const out: TabId[] = [];
    for (const v of parsed) {
      if (typeof v === "string" && VALID_IDS.has(v as TabId)) {
        out.push(v as TabId);
      }
    }
    return out;
  } catch {
    return undefined;
  }
}

export function loadHiddenTabs(): TabId[] {
  if (typeof window === "undefined") return [];
  return parseStored(localStorage.getItem(STORAGE_KEY)) ?? [];
}

export function saveHiddenTabs(hidden: readonly TabId[]): void {
  if (typeof window === "undefined") return;
  try {
    if (hidden.length === 0) {
      localStorage.removeItem(STORAGE_KEY);
    } else {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(hidden));
    }
  } catch {
    // ignore quota / SecurityError — the preference will just stay
    // unsaved this session.
  }
}

// Hook reads the per-device list once on mount and exposes a setter.
// SSR returns `[]` so the server-rendered nav matches the unconfigured
// default; the real value lands after hydration.
export function useHiddenTabs(): {
  hidden: TabId[];
  setHidden: (next: readonly TabId[]) => void;
} {
  const [hidden, setInternal] = useState<TabId[]>([]);
  useEffect(() => {
    setInternal(loadHiddenTabs());
  }, []);

  const setHidden = useCallback((next: readonly TabId[]) => {
    const deduped: TabId[] = [];
    const seen = new Set<TabId>();
    for (const id of next) {
      if (VALID_IDS.has(id) && !seen.has(id)) {
        seen.add(id);
        deduped.push(id);
      }
    }
    setInternal(deduped);
    saveHiddenTabs(deduped);
  }, []);

  return { hidden, setHidden };
}
