"use client";

import { Suspense, useCallback, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus } from "lucide-react";
import BudgetToolbar from "@/components/budget/BudgetToolbar";
import CategoryGroupSection from "@/components/budget/CategoryGroupSection";
import CategoryInspector from "@/components/budget/CategoryInspector";
import ReadyToAssignBanner from "@/components/budget/ReadyToAssignBanner";
import NoteEditor from "@/components/forms/NoteEditor";
import { useHorizonStore } from "@/components/store/HorizonStore";
import { useMediaQuery } from "@/components/hooks/useMediaQuery";
import { useCategoryReorderDrag } from "@/components/budget/useCategoryReorderDrag";
import {
  ccPaymentRouting,
  monthKeyOf,
  readyToAssignAmount,
  shiftMonthKey,
  visibleGroups,
} from "@/lib/budget";

const labelFmt = new Intl.DateTimeFormat("en-US", {
  month: "long",
  year: "numeric",
});

function labelFromMonthKey(monthKey: string): string {
  const [y, m] = monthKey.split("-").map(Number);
  return labelFmt.format(new Date(y, m - 1, 1));
}

export default function BudgetPage() {
  return (
    <Suspense fallback={null}>
      <Budget />
    </Suspense>
  );
}

function Budget() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedCategoryId = searchParams.get("cat") ?? "";
  const isWide = useMediaQuery("(min-width: 1024px)");
  const {
    groups,
    transactions,
    assignments,
    accounts,
    monthNotes,
    setMonthNote,
    addGroup,
    reorderGroup,
    reorderCategory,
  } = useHorizonStore();
  const shownGroups = visibleGroups(groups);
  const ccCtx = ccPaymentRouting(accounts, groups);
  const now = new Date();
  const [monthKey, setMonthKey] = useState<string>(() =>
    monthKeyOf(now.getFullYear(), now.getMonth()),
  );
  const ready = readyToAssignAmount(transactions, assignments, groups, ccCtx);

  // Inline edit mode — toggled from the toolbar's pencil button.
  // When on, each group/category gains drag, rename, add, and delete
  // affordances directly on this page; the deeper /budget/manage
  // route is no longer the only path to those actions.
  const [editMode, setEditMode] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");

  const { drag, gripPointerDown, rowStyle } = useCategoryReorderDrag({
    groups: shownGroups,
    reorderGroup,
    reorderCategory,
  });

  function submitNewGroup(e: FormEvent) {
    e.preventDefault();
    const name = newGroupName.trim();
    if (name === "") return;
    addGroup(name);
    setNewGroupName("");
  }

  const setSelectedCategory = useCallback(
    (id: string | null) => {
      const params = new URLSearchParams(searchParams.toString());
      if (id === null) params.delete("cat");
      else params.set("cat", id);
      const qs = params.toString();
      router.replace(qs ? `/budget?${qs}` : "/budget", { scroll: false });
    },
    [router, searchParams],
  );

  return (
    <div>
      <BudgetToolbar
        monthLabel={labelFromMonthKey(monthKey)}
        monthKey={monthKey}
        onPrev={() => setMonthKey((m) => shiftMonthKey(m, -1))}
        onNext={() => setMonthKey((m) => shiftMonthKey(m, 1))}
        editMode={editMode}
        onToggleEdit={() => setEditMode((v) => !v)}
      />
      <ReadyToAssignBanner amount={ready} />
      <div className="mx-4 mb-3">
        <NoteEditor
          value={monthNotes[monthKey] ?? ""}
          onCommit={(next) => setMonthNote(monthKey, next)}
          ariaLabel={`Note for ${labelFromMonthKey(monthKey)}`}
          placeholder="Add a note for this month"
        />
      </div>
      <div className="lg:flex lg:gap-4 lg:px-4 lg:items-start">
        <div className="flex flex-col gap-2 lg:flex-1 lg:min-w-0 lg:rounded-2xl lg:overflow-hidden lg:border lg:border-fg/5">
          {shownGroups.map((group) => (
            <CategoryGroupSection
              key={group.id}
              group={group}
              monthKey={monthKey}
              onSelectCategory={
                isWide && !editMode
                  ? (id) => setSelectedCategory(id)
                  : undefined
              }
              selectedCategoryId={isWide ? selectedCategoryId : undefined}
              editMode={editMode}
              drag={drag}
              gripPointerDown={gripPointerDown}
              rowStyle={rowStyle}
            />
          ))}

          {editMode && (
            <form
              onSubmit={submitNewGroup}
              className="mx-4 mt-3 mb-2 flex items-center gap-2 rounded-2xl bg-card p-4"
            >
              <input
                type="text"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                placeholder="Add a group"
                className="flex-1 rounded-md bg-card-elevated px-3 py-2 text-base outline-none placeholder:text-fg/40"
              />
              <button
                type="submit"
                aria-label="Add group"
                className="grid h-10 w-10 place-items-center rounded-full bg-accent text-fg"
              >
                <Plus size={18} strokeWidth={2.5} />
              </button>
            </form>
          )}
        </div>
        {isWide && (
          <aside
            aria-label="Category inspector"
            className="hidden lg:block lg:w-[44%] lg:flex-shrink-0 lg:sticky lg:top-3 lg:self-start lg:max-h-[calc(100dvh-2rem)] lg:overflow-y-auto lg:rounded-2xl lg:bg-card-elevated/40 lg:border lg:border-fg/5"
          >
            {selectedCategoryId ? (
              <CategoryInspector
                categoryId={selectedCategoryId}
                monthKey={monthKey}
                onClose={() => setSelectedCategory(null)}
              />
            ) : (
              <div className="px-6 py-12 text-center text-sm text-fg/55">
                Pick a category on the left to see its target, activity, and
                recent transactions here.
              </div>
            )}
          </aside>
        )}
      </div>
    </div>
  );
}
