"use client";

import { useMemo } from "react";
import { Sparkles } from "lucide-react";
import { useHorizonStore } from "@/components/store/HorizonStore";
import { generateWeeklyInsights, type WeeklyInsight } from "@/lib/insights";

const toneClass: Record<NonNullable<WeeklyInsight["stats"][number]["tone"]>, string> = {
  good: "text-emerald-400",
  bad: "text-rose-300",
  neutral: "text-fg/85",
};

// Surface a small set of auto-generated weekly summaries. Hidden when
// there's nothing to say so the home tab doesn't add empty cards on
// fresh installs.
export default function WeeklyInsightsSection() {
  const { transactions } = useHorizonStore();
  const insights = useMemo(
    () => generateWeeklyInsights(transactions),
    [transactions],
  );
  if (insights.length === 0) return null;

  return (
    <section className="rounded-3xl bg-card p-4">
      <div className="flex items-center gap-2 text-sm font-bold">
        <Sparkles size={16} className="text-accent" strokeWidth={2.4} />
        <span>This week</span>
      </div>
      <ul className="mt-3 flex flex-col gap-2">
        {insights.map((i) => (
          <li
            key={i.id}
            className="rounded-2xl bg-card-elevated px-3 py-2.5"
          >
            <p className="text-sm font-bold">{i.title}</p>
            <dl className="mt-1.5 grid grid-cols-2 gap-y-1 text-xs">
              {i.stats.map((s, idx) => (
                <div
                  key={idx}
                  className="contents"
                >
                  <dt className="text-fg/55">{s.label}</dt>
                  <dd
                    className={`text-right font-semibold tabular-nums ${
                      s.tone ? toneClass[s.tone] : "text-fg/85"
                    }`}
                  >
                    {s.value}
                  </dd>
                </div>
              ))}
            </dl>
            {i.footnote && (
              <p className="mt-1 text-[11px] text-fg/55">{i.footnote}</p>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
