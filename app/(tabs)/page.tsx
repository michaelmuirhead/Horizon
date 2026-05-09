import HomeHeader from "@/components/home/HomeHeader";
import QuickAddSection from "@/components/home/QuickAddSection";
import PinnedSection from "@/components/home/PinnedSection";
import GoalSection from "@/components/home/GoalSection";
import SummarySection from "@/components/home/SummarySection";
import FutureMonthsSection from "@/components/home/FutureMonthsSection";
import WishlistSection from "@/components/home/WishlistSection";

const HOUSEHOLD = "Muirhead Family";

export default function HomePage() {
  const now = new Date();
  const monthFmt = new Intl.DateTimeFormat("en-US", { month: "long" });
  const currentMonth = monthFmt.format(now);

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
        <QuickAddSection />
        <PinnedSection />
        <GoalSection />
        <WishlistSection />
        <SummarySection month={currentMonth} />
        <FutureMonthsSection />
      </div>
    </div>
  );
}
