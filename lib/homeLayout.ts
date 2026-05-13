// Shared metadata for the customizable home dashboard. The HomePage
// renders sections in the order resolved here, and the Settings page
// uses the same list to drive the reorder/hide UI.

import type { HomeSectionPreference } from "@/components/store/HorizonStore";

export type HomeSectionId =
  | "quick-add"
  | "pinned"
  | "goals"
  | "weekly-insights"
  | "wishlist"
  | "upcoming-debts"
  | "bills-calendar"
  | "summary"
  | "future-months";

export type HomeSectionMeta = {
  id: HomeSectionId;
  label: string;
  // Short description shown under the toggle in settings.
  description: string;
  // Sections the user almost never wants to hide outright. We still
  // allow it — the toggle is the user's call — but we don't suggest
  // hiding by default.
  essential?: boolean;
};

// The authoritative default order. New sections are appended; never
// reorder this array casually, since a user's saved layout references
// these ids and "unknown" ids fall to the end.
export const HOME_SECTION_ORDER: HomeSectionMeta[] = [
  {
    id: "quick-add",
    label: "Quick Add",
    description: "Shortcuts for adding a transaction, transfer, etc.",
    essential: true,
  },
  {
    id: "pinned",
    label: "Pinned categories",
    description: "Quick-look at categories you've pinned in the budget.",
  },
  {
    id: "goals",
    label: "Featured goal",
    description: "Spotlights one savings goal or by-date target.",
  },
  {
    id: "weekly-insights",
    label: "Weekly insights",
    description: "Auto-generated summaries of this week's activity.",
  },
  {
    id: "wishlist",
    label: "Wishlist",
    description: "Items you're saving toward but haven't committed to.",
  },
  {
    id: "upcoming-debts",
    label: "Upcoming debt payments",
    description: "Debts due in the next 7 days.",
  },
  {
    id: "bills-calendar",
    label: "Bills calendar",
    description: "Scheduled transactions for the rest of the month.",
  },
  {
    id: "summary",
    label: "Monthly summary",
    description: "Income vs. expenses for the current month.",
  },
  {
    id: "future-months",
    label: "Future months",
    description: "Assignments queued for next month.",
  },
];

export type ResolvedHomeSection = {
  id: HomeSectionId;
  hidden: boolean;
};

// Combines the user's saved preferences with the default order. Output
// is a complete list of every known section in the user's intended
// order, with a `hidden` flag the renderer respects. Unknown ids in
// the saved layout are dropped silently (probably from a removed
// section after an app update).
export function resolveHomeLayout(
  saved: HomeSectionPreference[] | undefined,
): ResolvedHomeSection[] {
  const knownIds = new Set<HomeSectionId>(
    HOME_SECTION_ORDER.map((s) => s.id),
  );
  const seen = new Set<HomeSectionId>();
  const out: ResolvedHomeSection[] = [];

  for (const pref of saved ?? []) {
    if (!knownIds.has(pref.id as HomeSectionId)) continue;
    if (seen.has(pref.id as HomeSectionId)) continue;
    seen.add(pref.id as HomeSectionId);
    out.push({
      id: pref.id as HomeSectionId,
      hidden: pref.hidden === true,
    });
  }
  // Append any known sections the user hasn't touched yet — keeps
  // newly-added sections visible by default after an app upgrade.
  for (const meta of HOME_SECTION_ORDER) {
    if (seen.has(meta.id)) continue;
    out.push({ id: meta.id, hidden: false });
  }
  return out;
}

// Convenience helper: produce the saved-prefs array from a resolved
// view, dropping default-positioned entries that haven't been
// customized so the persisted blob stays small.
export function toSavedLayout(
  resolved: ResolvedHomeSection[],
): HomeSectionPreference[] {
  return resolved.map((r) =>
    r.hidden ? { id: r.id, hidden: true } : { id: r.id },
  );
}
