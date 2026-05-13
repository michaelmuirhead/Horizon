"use client";

import Link from "next/link";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Pencil,
  Target,
  Wand2,
} from "lucide-react";

type Props = {
  monthLabel: string;
  monthKey: string;
  onPrev: () => void;
  onNext: () => void;
  // Inline edit mode on the budget tab: drag, rename, add, delete
  // categories without navigating to /budget/manage.
  editMode: boolean;
  onToggleEdit: () => void;
};

export default function BudgetToolbar({
  monthLabel,
  monthKey,
  onPrev,
  onNext,
  editMode,
  onToggleEdit,
}: Props) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 pt-[max(env(safe-area-inset-top),12px)] pb-3">
      <div className="hz-capsule flex items-center rounded-full overflow-hidden">
        <Link
          href={`/budget/auto-assign?month=${monthKey}`}
          aria-label="Auto-assign"
          className="grid h-10 w-14 place-items-center"
        >
          <Wand2 size={18} strokeWidth={2.2} />
        </Link>
        <span aria-hidden className="h-5 w-px bg-white/10" />
        <Link
          href="/goals"
          aria-label="Goals overview"
          className="grid h-10 w-14 place-items-center"
        >
          <Target size={18} strokeWidth={2.2} />
        </Link>
      </div>

      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={onPrev}
          aria-label="Previous month"
          className="grid h-8 w-8 place-items-center rounded-full hover:bg-card-elevated"
        >
          <ChevronLeft size={18} strokeWidth={2.5} />
        </button>
        <span className="min-w-[120px] text-center text-xl font-bold">
          {monthLabel}
        </span>
        <button
          type="button"
          onClick={onNext}
          aria-label="Next month"
          className="grid h-8 w-8 place-items-center rounded-full hover:bg-card-elevated"
        >
          <ChevronRight size={18} strokeWidth={2.5} />
        </button>
      </div>

      <button
        type="button"
        onClick={onToggleEdit}
        aria-label={editMode ? "Finish editing" : "Edit categories"}
        aria-pressed={editMode}
        className={`hz-capsule grid h-10 w-10 place-items-center rounded-full transition-colors ${
          editMode ? "bg-accent text-page" : ""
        }`}
      >
        {editMode ? (
          <Check size={20} strokeWidth={2.5} />
        ) : (
          <Pencil size={18} strokeWidth={2.5} />
        )}
      </button>
    </div>
  );
}
