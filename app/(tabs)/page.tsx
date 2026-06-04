"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import HomeHeader from "@/components/home/HomeHeader";
import QuickAddSection from "@/components/home/QuickAddSection";
import PinnedSection from "@/components/home/PinnedSection";
import GoalSection from "@/components/home/GoalSection";
import SummarySection from "@/components/home/SummarySection";
import BillsCalendarSection from "@/components/home/BillsCalendarSection";
import UpcomingDebtsSection from "@/components/home/UpcomingDebtsSection";
import FutureMonthsSection from "@/components/home/FutureMonthsSection";
import WishlistSection from "@/components/home/WishlistSection";
import WeeklyInsightsSection from "@/components/home/WeeklyInsightsSection";
import FudgetSection from "@/components/home/FudgetSection";
import { useHorizonStore } from "@/components/store/HorizonStore";
import { resolveHomeLayout, type HomeSectionId } from "@/lib/homeLayout";
import { useHomeLayout } from "@/lib/homeLayoutStore";
import { useHiddenTabs, visibleTabs } from "@/lib/tabs";

const HOUSEHOLD = "Muirhead Family";

export default function HomePage() {
  const router = useRouter();
  const { hidden: hiddenTabs } = useHiddenTabs();
  // If the user has hidden the Home tab there's no nav entry to
  // navigate away with, so bounce them at the first remaining tab.
  // Effect runs post-hydration; the stored list is empty on SSR, so a
  // user with Home visible never sees this fire.
  useEffect(() => {
    if (!hiddenTabs.includes("home")) return;
    const next = visibleTabs(hiddenTabs)[0];
    if (next && next.href !== "/") router.replace(next.href);
  }, [hiddenTabs, router]);

  const { settings } = useHorizonStore();
  // Home layout is per-device — household members each customize
  // their own arrangement. settings.homeSectionLayout is the legacy
  // migration source: if a user's old (synced) layout is the only
  // thing we have, the hook copies it down on first load so they
  // don't lose their arrangement.
  const { layout: savedLayout } = useHomeLayout(settings.homeSectionLayout);
  const now = new Date();
  const monthFmt = new Intl.DateTimeFormat("en-US", { month: "long" });
  const currentMonth = monthFmt.format(now);

  const layout = resolveHomeLayout(savedLayout);

  // Section components keyed by id. Each section is responsible for
  // its own "hide when empty" behavior (e.g. UpcomingDebtsSection
  // returns null when there's nothing to show) — the layout's `hidden`
  // flag is a user-driven override on top of that.
  const sections: Record<HomeSectionId, React.ReactNode> = {
    "quick-add": <QuickAddSection />,
    pinned: <PinnedSection />,
    goals: <GoalSection />,
    "weekly-insights": <WeeklyInsightsSection />,
    wishlist: <WishlistSection />,
    "upcoming-debts": <UpcomingDebtsSection />,
    "bills-calendar": <BillsCalendarSection />,
    summary: <SummarySection month={currentMonth} />,
    "future-months": <FutureMonthsSection />,
    fudget: <FudgetSection />,
  };

  return (
    <div className="relative">
      {/* Gradient banner behind the header */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[360px]"
      >
        <div className="h-full w-full bg-gradient-to-r from-gradient-from to-gradient-to" />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-page" />
      </div>

      <div className="relative px-4 pt-[max(env(safe-area-inset-top),16px)] pb-2">
        <HomeHeader household={HOUSEHOLD} />
      </div>

      <div className="relative flex flex-col gap-4 px-4 pb-6">
        {layout.map((s) =>
          s.hidden ? null : (
            <div key={s.id}>{sections[s.id]}</div>
          ),
        )}
      </div>
    </div>
  );
}
