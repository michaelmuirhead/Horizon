"use client";

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Eye, EyeOff } from "lucide-react";
import SubpageHeader from "@/components/layout/SubpageHeader";
import { useHorizonStore } from "@/components/store/HorizonStore";
import {
  HOME_SECTION_ORDER,
  resolveHomeLayout,
  toSavedLayout,
  type HomeSectionId,
  type ResolvedHomeSection,
} from "@/lib/homeLayout";

export default function HomeLayoutPage() {
  const { settings, setSettings } = useHorizonStore();

  // Local working copy of the layout, hydrated from settings on first
  // render and edited via the buttons below. We persist on every change
  // (no explicit "Save") so back-button doesn't drop edits.
  const initial = useMemo(
    () => resolveHomeLayout(settings.homeSectionLayout),
    [settings.homeSectionLayout],
  );
  const [layout, setLayout] = useState<ResolvedHomeSection[]>(initial);

  const metaById = useMemo(() => {
    const m = new Map<HomeSectionId, (typeof HOME_SECTION_ORDER)[number]>();
    for (const s of HOME_SECTION_ORDER) m.set(s.id, s);
    return m;
  }, []);

  function persist(next: ResolvedHomeSection[]) {
    setLayout(next);
    setSettings({ ...settings, homeSectionLayout: toSavedLayout(next) });
  }

  function move(idx: number, delta: -1 | 1) {
    const next = layout.slice();
    const target = idx + delta;
    if (target < 0 || target >= next.length) return;
    [next[idx], next[target]] = [next[target], next[idx]];
    persist(next);
  }

  function toggleHidden(idx: number) {
    const next = layout.slice();
    next[idx] = { ...next[idx], hidden: !next[idx].hidden };
    persist(next);
  }

  function resetToDefault() {
    setLayout(initial.map((r) => ({ id: r.id, hidden: false })));
    setSettings({ ...settings, homeSectionLayout: undefined });
  }

  return (
    <>
      <SubpageHeader title="Customize home" backHref="/settings" />
      <div className="px-4 pt-2 pb-10 space-y-4">
        <p className="text-sm text-fg/65">
          Drag the up/down arrows to change section order, or hide the ones
          you don&rsquo;t use. Sections that have nothing to show (e.g. no
          upcoming debts) hide themselves automatically &mdash; this just
          controls whether they appear at all.
        </p>

        <ul className="flex flex-col gap-2">
          {layout.map((s, idx) => {
            const meta = metaById.get(s.id);
            if (!meta) return null;
            return (
              <li
                key={s.id}
                className={`rounded-2xl bg-card-elevated px-3 py-3 ${
                  s.hidden ? "opacity-60" : ""
                }`}
              >
                <div className="flex items-center gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-base font-bold truncate">
                      {meta.label}
                      {meta.essential && (
                        <span className="ml-2 rounded-full bg-accent/15 px-1.5 py-0.5 align-middle text-[10px] font-semibold uppercase tracking-wide text-accent">
                          core
                        </span>
                      )}
                    </p>
                    <p className="mt-0.5 text-xs text-fg/55">
                      {meta.description}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => move(idx, -1)}
                    disabled={idx === 0}
                    aria-label={`Move ${meta.label} up`}
                    className="grid h-8 w-8 place-items-center rounded-full text-fg/70 hover:bg-card disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <ArrowUp size={16} strokeWidth={2.4} />
                  </button>
                  <button
                    type="button"
                    onClick={() => move(idx, 1)}
                    disabled={idx === layout.length - 1}
                    aria-label={`Move ${meta.label} down`}
                    className="grid h-8 w-8 place-items-center rounded-full text-fg/70 hover:bg-card disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <ArrowDown size={16} strokeWidth={2.4} />
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleHidden(idx)}
                    aria-label={s.hidden ? "Show" : "Hide"}
                    className="grid h-8 w-8 place-items-center rounded-full text-fg/70 hover:bg-card"
                  >
                    {s.hidden ? (
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
          className="w-full rounded-full border border-fg/15 px-4 py-2.5 text-sm font-bold text-fg/70"
        >
          Reset to default order
        </button>
      </div>
    </>
  );
}
