"use client";

import { useMemo } from "react";
import { Eye, EyeOff } from "lucide-react";
import SubpageHeader from "@/components/layout/SubpageHeader";
import { TABS, useHiddenTabs, type TabId } from "@/lib/tabs";

export default function TabsSettingsPage() {
  const { hidden, setHidden } = useHiddenTabs();
  const hiddenSet = useMemo(() => new Set(hidden), [hidden]);
  const visibleCount = TABS.length - hiddenSet.size;

  function toggle(id: TabId) {
    if (hiddenSet.has(id)) {
      setHidden(hidden.filter((h) => h !== id));
    } else {
      // Refuse to hide the last visible tab — the user would be left
      // with nothing in the bottom nav and no way to navigate.
      if (visibleCount <= 1) return;
      setHidden([...hidden, id]);
    }
  }

  function resetToDefault() {
    setHidden([]);
  }

  return (
    <>
      <SubpageHeader title="Customize tabs" backHref="/settings" />
      <div className="px-4 pt-2 pb-10 space-y-4">
        <p className="text-sm text-fg/65">
          Tap the eye icon to hide a tab from the bottom nav. The pages
          themselves stay reachable by URL and keyboard shortcuts &mdash;
          this just strips the icon so the app shows only what you use.
        </p>
        <p className="text-xs text-fg/55">
          Saved on this device only, so household members on other
          devices keep their own tab arrangement.
        </p>

        <ul className="flex flex-col gap-2">
          {TABS.map((tab) => {
            const isHidden = hiddenSet.has(tab.id);
            const isLastVisible = !isHidden && visibleCount <= 1;
            const Icon = tab.icon;
            return (
              <li
                key={tab.id}
                className={`rounded-2xl bg-card-elevated px-3 py-3 ${
                  isHidden ? "opacity-60" : ""
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-card text-fg/80">
                    <Icon size={18} strokeWidth={2.2} />
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-base font-bold truncate">{tab.label}</p>
                    <p className="mt-0.5 text-xs text-fg/55 truncate">
                      {tab.href}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => toggle(tab.id)}
                    disabled={isLastVisible}
                    aria-label={isHidden ? `Show ${tab.label}` : `Hide ${tab.label}`}
                    aria-pressed={!isHidden}
                    title={
                      isLastVisible
                        ? "At least one tab must remain visible"
                        : undefined
                    }
                    className="grid h-9 w-9 place-items-center rounded-full text-fg/70 hover:bg-card disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    {isHidden ? (
                      <EyeOff size={16} strokeWidth={2.4} />
                    ) : (
                      <Eye size={16} strokeWidth={2.4} />
                    )}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>

        <button
          type="button"
          onClick={resetToDefault}
          disabled={hidden.length === 0}
          className="w-full rounded-full border border-fg/15 px-4 py-2.5 text-sm font-bold text-fg/70 disabled:opacity-40"
        >
          Show all tabs
        </button>
      </div>
    </>
  );
}
