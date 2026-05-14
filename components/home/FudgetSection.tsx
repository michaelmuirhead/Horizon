"use client";

import Link from "next/link";
import { useMemo } from "react";
import { CalendarClock, ChevronRight } from "lucide-react";
import { useHorizonStore } from "@/components/store/HorizonStore";
import { folderBalance } from "@/lib/planner";
import { formatCurrency } from "@/lib/format";

// Home-tab summary for the Fudget feature (folders → budgets →
// entries on the bottom-nav Fudget tab). Lists each folder with its
// running balance — same shape as the Fudget tab's top level —
// followed by a single link to the full page. Hidden entirely when
// the user has no folders so a fresh install doesn't carry an empty
// card.
export default function FudgetSection() {
  const { plannerFolders, plannerBudgets, plannerEntries } = useHorizonStore();

  const sorted = useMemo(
    () =>
      plannerFolders
        .slice()
        .sort(
          (a, b) =>
            (a.order ?? Number.MAX_SAFE_INTEGER) -
            (b.order ?? Number.MAX_SAFE_INTEGER),
        ),
    [plannerFolders],
  );

  if (sorted.length === 0) return null;

  return (
    <section className="rounded-3xl bg-card p-4">
      <div className="flex items-center gap-2 text-sm font-bold">
        <CalendarClock size={16} className="text-accent" strokeWidth={2.4} />
        <span>Fudget</span>
      </div>
      <ul className="mt-3 flex flex-col gap-2">
        {sorted.map((folder) => {
          const balance = folderBalance(
            folder.id,
            plannerBudgets,
            plannerEntries,
          );
          const tone =
            balance > 0
              ? "text-emerald-400"
              : balance < 0
                ? "text-rose-400"
                : "text-fg/60";
          return (
            <li key={folder.id}>
              <Link
                href={`/planner/${folder.id}`}
                className="flex items-center gap-3 rounded-2xl bg-card-elevated px-3 py-2.5"
              >
                <span className="flex-1 truncate text-base font-semibold">
                  {folder.name}
                </span>
                <span
                  className={`text-base font-bold tabular-nums shrink-0 ${tone}`}
                >
                  {balance >= 0 ? "+" : "−"}
                  {formatCurrency(Math.abs(balance))}
                </span>
                <ChevronRight size={14} className="text-fg/40 shrink-0" />
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
