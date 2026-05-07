"use client";

import { ChevronRight, PlayCircle } from "lucide-react";
import CollapsibleCard from "./CollapsibleCard";
import { formatCurrency } from "@/lib/format";
import { useHorizonStore } from "@/components/store/HorizonStore";
import { monthKeyOf, totalAssignedInMonth } from "@/lib/budget";

const monthFmt = new Intl.DateTimeFormat("en-US", { month: "long" });

export default function FutureMonthsSection() {
  const { assignments } = useHorizonStore();
  const now = new Date();
  const next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const nextMonthLabel = monthFmt.format(next);
  const nextMonthKey = monthKeyOf(next.getFullYear(), next.getMonth());
  const amount = totalAssignedInMonth(assignments, nextMonthKey);

  return (
    <CollapsibleCard title="Assigned in Future Months">
      <div className="flex flex-col gap-3">
        <button
          type="button"
          className="flex items-center justify-between rounded-2xl bg-card-elevated px-4 py-4"
        >
          <span className="text-base font-semibold">{nextMonthLabel}</span>
          <span className="flex items-center gap-2">
            <span className="text-base font-semibold">
              {formatCurrency(amount)}
            </span>
            <ChevronRight size={16} className="text-fg/55" />
          </span>
        </button>

        <button
          type="button"
          className="flex items-center justify-center gap-2 rounded-2xl bg-card-elevated px-4 py-4 text-accent text-base font-bold"
        >
          <PlayCircle size={20} />
          How to get a month ahead
        </button>
      </div>
    </CollapsibleCard>
  );
}
