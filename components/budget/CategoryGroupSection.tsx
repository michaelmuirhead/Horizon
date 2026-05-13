"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { ChevronDown, GripVertical, Pin, Plus, Target, Trash2 } from "lucide-react";
import type { BudgetCategory, BudgetCategoryGroup } from "@/lib/budget";
import {
  cadenceShortLabel,
  categoryAvailable,
  categoryUnderfundedForMonth,
  ccPaymentRouting,
  formatTargetDate,
  getAssigned,
  groupTotals,
  monthlyNeedForCategory,
} from "@/lib/budget";
import { formatCurrency } from "@/lib/format";
import { ordinalDay } from "@/lib/debtDueDate";
import EditableText from "@/components/forms/EditableText";
import { useHorizonStore } from "@/components/store/HorizonStore";
import {
  GRIP_STYLE,
  type useCategoryReorderDrag,
} from "@/components/budget/useCategoryReorderDrag";
import AvailablePill from "./AvailablePill";
import AssignedCell from "./AssignedCell";

function targetSubtitle(
  category: BudgetCategory,
  ctx: {
    targets: ReturnType<typeof useHorizonStore>["targets"];
    assignments: ReturnType<typeof useHorizonStore>["assignments"];
    transactions: ReturnType<typeof useHorizonStore>["transactions"];
    monthKey: string;
  },
): { text: string; underfunded: boolean } | null {
  const target = ctx.targets[category.id];
  if (!target) return null;
  if (target.paused) {
    return { text: "Paused", underfunded: false };
  }
  const underfunded = categoryUnderfundedForMonth(
    category,
    target,
    ctx.assignments,
    ctx.transactions,
    ctx.monthKey,
  );
  if (target.kind === "set-aside") {
    const cadence = cadenceShortLabel(target.cadence);
    return underfunded > 0
      ? { text: `${formatCurrency(underfunded)} short`, underfunded: true }
      : {
          text: `Funded · ${formatCurrency(target.amount)}/${cadence}`,
          underfunded: false,
        };
  }
  if (target.kind === "refill") {
    const need = monthlyNeedForCategory(
      category,
      target,
      ctx.assignments,
      ctx.transactions,
      ctx.monthKey,
    );
    if (underfunded > 0) {
      return {
        text: `Need ${formatCurrency(need)}/mo · ${formatCurrency(underfunded)} short to refill`,
        underfunded: true,
      };
    }
    return {
      text: `Refilled · ${formatCurrency(target.amount)}/mo`,
      underfunded: false,
    };
  }
  if (target.kind === "spending") {
    // Spent so far this month, by combining splits + non-split outflows.
    let spent = 0;
    for (const t of ctx.transactions) {
      if (t.isReadyToAssign || t.transferId) continue;
      const [y, m] = t.date.split("-").map(Number);
      const mk = `${y}-${String(m).padStart(2, "0")}`;
      if (mk !== ctx.monthKey) continue;
      if (t.splits && t.splits.length > 0) {
        for (const s of t.splits) {
          if (s.category === category.name && s.amount < 0) spent += -s.amount;
        }
      } else if (t.category === category.name && t.amount < 0) {
        spent += -t.amount;
      }
    }
    const overspent = spent > target.amount;
    return {
      text: overspent
        ? `${formatCurrency(spent - target.amount)} over · ${formatCurrency(spent)} of ${formatCurrency(target.amount)}`
        : `${formatCurrency(spent)} of ${formatCurrency(target.amount)} this month`,
      underfunded: overspent,
    };
  }
  const due = formatTargetDate(target.dueDate);
  const need = monthlyNeedForCategory(
    category,
    target,
    ctx.assignments,
    ctx.transactions,
    ctx.monthKey,
  );
  // Three states for a sinking-fund (by-date) target:
  //   1. Already saved enough at start of month — `need` = 0.
  //   2. This month's assignment hasn't covered the per-month catch-up yet.
  //   3. Caught up for the month — assigned ≥ need.
  // The per-month figure auto-grows when prior months are missed (because
  // `categoryAvailableAtStart` carries less forward) and shrinks when the
  // user assigns more than required (next month's `startAvailable` is higher).
  if (need <= 0) {
    return { text: `Saved · ready by ${due}`, underfunded: false };
  }
  if (underfunded > 0) {
    return {
      text: `Need ${formatCurrency(need)}/mo · ${formatCurrency(underfunded)} short for ${due}`,
      underfunded: true,
    };
  }
  return {
    text: `Need ${formatCurrency(need)}/mo for ${due} · funded`,
    underfunded: false,
  };
}

type DragHandlers = ReturnType<typeof useCategoryReorderDrag>;

export default function CategoryGroupSection({
  group,
  monthKey,
  onSelectCategory,
  selectedCategoryId,
  editMode = false,
  drag,
  gripPointerDown,
  rowStyle,
}: {
  group: BudgetCategoryGroup;
  monthKey: string;
  // When set, tapping a category's name opens it in a side inspector
  // instead of being purely informational. Used by the iPad two-pane Budget.
  onSelectCategory?: (categoryId: string) => void;
  selectedCategoryId?: string;
  // When true, the section renders inline edit affordances: drag grips
  // on the header + each row, the name becomes an EditableText, an
  // "Add category" form appears at the bottom, and a delete button
  // shows next to each category. Drag handlers come from the
  // useCategoryReorderDrag hook on the parent page.
  editMode?: boolean;
  drag?: DragHandlers["drag"];
  gripPointerDown?: DragHandlers["gripPointerDown"];
  rowStyle?: DragHandlers["rowStyle"];
}) {
  const [expanded, setExpanded] = useState(true);
  const {
    transactions,
    assignments,
    pinnedCategoryIds,
    targets,
    accounts,
    groups,
    setAssignment,
    togglePin,
    addCategory,
    renameCategory,
    renameGroup,
    deleteCategory,
    deleteGroup,
    markUndoable,
  } = useHorizonStore();
  const [newCategoryName, setNewCategoryName] = useState("");

  function submitNewCategory(e: FormEvent) {
    e.preventDefault();
    const name = newCategoryName.trim();
    if (name === "") return;
    addCategory(group.id, name);
    setNewCategoryName("");
  }

  function handleRenameCategory(categoryId: string, currentName: string) {
    return (next: string) => {
      const trimmed = next.trim();
      if (trimmed === "" || trimmed === currentName) return;
      renameCategory(categoryId, trimmed);
    };
  }

  function handleRenameGroup(next: string) {
    const trimmed = next.trim();
    if (trimmed === "" || trimmed === group.name) return;
    renameGroup(group.id, trimmed);
  }

  // Highlight whenever this group is the current drop target: either a
  // group reorder hover OR a category-from-another-group hover that
  // would append into this group's body.
  const groupHighlighted =
    editMode &&
    drag !== null &&
    drag !== undefined &&
    drag.hoverGroupId === group.id &&
    !drag.hoverCategoryId &&
    (drag.kind === "group"
      ? drag.sourceId !== group.id
      : !group.categories.some((c) => c.id === drag.sourceId));
  const ccCtx = ccPaymentRouting(accounts, groups);
  const { assigned, available } = groupTotals(
    group,
    assignments,
    transactions,
    monthKey,
    ccCtx,
  );

  return (
    <section
      data-mc-group={editMode ? group.id : undefined}
      style={editMode ? rowStyle?.("group", group.id) : undefined}
      className={`transition-shadow ${
        groupHighlighted ? "ring-2 ring-accent/60 rounded-2xl" : ""
      }`}
    >
      <div className="flex w-full items-center gap-3 bg-card px-4 py-4">
        {editMode && gripPointerDown && (
          <button
            type="button"
            aria-label={`Drag ${group.name}`}
            onPointerDown={gripPointerDown("group", group.id)}
            style={GRIP_STYLE}
            className="grid h-8 w-6 shrink-0 place-items-center text-fg/40 cursor-grab active:cursor-grabbing"
          >
            <GripVertical size={16} />
          </button>
        )}
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          aria-label={expanded ? `Collapse ${group.name}` : `Expand ${group.name}`}
          className="grid h-8 w-6 shrink-0 place-items-center text-left"
        >
          <ChevronDown
            size={16}
            strokeWidth={2.5}
            className={`transition-transform ${expanded ? "" : "-rotate-90"}`}
          />
        </button>
        {editMode ? (
          <div className="flex-1 min-w-0 flex items-center gap-2">
            {group.emoji && (
              <span aria-hidden className="text-lg">
                {group.emoji}
              </span>
            )}
            <EditableText
              value={group.name}
              onCommit={handleRenameGroup}
              ariaLabel={`Rename group ${group.name}`}
              className="flex-1 min-w-0 text-xl font-bold"
            />
          </div>
        ) : (
          <h2 className="flex-1 text-xl font-bold">
            {group.emoji && (
              <span aria-hidden className="mr-1.5">
                {group.emoji}
              </span>
            )}
            {group.name}
          </h2>
        )}
        {!editMode && (
          <>
            <div className="w-24 text-right">
              <p className="text-xs font-medium text-fg/70">Assigned</p>
              <p className="text-base font-bold tabular-nums">
                {formatCurrency(assigned)}
              </p>
            </div>
            <div className="w-24 text-right">
              <p className="text-xs font-medium text-fg/70">Available</p>
              <p
                className={`text-base font-bold tabular-nums ${
                  available < 0 ? "text-rose-400" : ""
                }`}
              >
                {formatCurrency(available)}
              </p>
            </div>
          </>
        )}
        {editMode && (
          <button
            type="button"
            onClick={() => {
              if (
                window.confirm(
                  `Delete group "${group.name}"? This removes ${group.categories.length} ${group.categories.length === 1 ? "category" : "categories"} along with their assignments and targets.`,
                )
              ) {
                markUndoable(`Group "${group.name}" deleted`);
                deleteGroup(group.id);
              }
            }}
            aria-label={`Delete group ${group.name}`}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-rose-400/70 hover:text-rose-400"
          >
            <Trash2 size={14} strokeWidth={2.4} />
          </button>
        )}
      </div>

      {expanded && (
        <ul className="hz-fade-in">
          {group.categories.map((cat, i) => {
            const pinned = pinnedCategoryIds.includes(cat.id);
            const target = targets[cat.id];
            const baseSubtitle = targetSubtitle(cat, {
              targets,
              assignments,
              transactions,
              monthKey,
            });
            // If this category mirrors a Bill account, append "due Nth"
            // so the due-day is visible without leaving the Budget tab.
            // Looking the bill up by billCategoryId rather than name
            // keeps the link stable across renames.
            const linkedBill = accounts.find(
              (a) =>
                a.type === "bill" &&
                a.billCategoryId === cat.id &&
                typeof a.paymentDueDayOfMonth === "number",
            );
            const subtitle = linkedBill
              ? {
                  text: baseSubtitle
                    ? `${baseSubtitle.text} · due ${ordinalDay(
                        linkedBill.paymentDueDayOfMonth as number,
                      )}`
                    : `Due ${ordinalDay(
                        linkedBill.paymentDueDayOfMonth as number,
                      )}`,
                  underfunded: baseSubtitle?.underfunded ?? false,
                }
              : baseSubtitle;
            const targetHref = `/goal/new?category=${encodeURIComponent(cat.id)}`;
            const rowHighlighted =
              editMode &&
              drag !== null &&
              drag !== undefined &&
              drag.kind === "category" &&
              drag.hoverCategoryId === cat.id &&
              drag.sourceId !== cat.id;
            return (
              <li
                key={cat.id}
                data-mc-category={editMode ? cat.id : undefined}
                style={editMode ? rowStyle?.("category", cat.id) : undefined}
                className={`flex items-center gap-2 px-4 py-4 ${
                  selectedCategoryId === cat.id
                    ? "bg-accent/15"
                    : "bg-list-row"
                } ${
                  i < group.categories.length - 1
                    ? "border-b border-fg/5"
                    : ""
                } ${rowHighlighted ? "bg-accent/10" : ""}`}
              >
                {editMode && gripPointerDown && (
                  <button
                    type="button"
                    aria-label={`Drag ${cat.name}`}
                    onPointerDown={gripPointerDown("category", cat.id)}
                    style={GRIP_STYLE}
                    className="grid h-7 w-5 shrink-0 place-items-center text-fg/30 cursor-grab active:cursor-grabbing"
                  >
                    <GripVertical size={14} />
                  </button>
                )}
                {editMode ? (
                  <div className="flex-1 min-w-0 flex items-center gap-2">
                    {cat.emoji && (
                      <span aria-hidden className="text-base">
                        {cat.emoji}
                      </span>
                    )}
                    <EditableText
                      value={cat.name}
                      onCommit={handleRenameCategory(cat.id, cat.name)}
                      ariaLabel={`Rename category ${cat.name}`}
                      className="flex-1 min-w-0 text-base font-semibold"
                    />
                  </div>
                ) : onSelectCategory ? (
                  <button
                    type="button"
                    onClick={() => onSelectCategory(cat.id)}
                    aria-pressed={selectedCategoryId === cat.id}
                    className="flex-1 min-w-0 text-left"
                  >
                    <span className="block text-base font-semibold truncate">
                      {cat.emoji && (
                        <span aria-hidden className="mr-1.5">
                          {cat.emoji}
                        </span>
                      )}
                      {cat.name}
                    </span>
                    {subtitle && (
                      <span
                        className={`mt-0.5 block text-xs truncate ${
                          subtitle.underfunded
                            ? "text-amber-400"
                            : "text-fg/55"
                        }`}
                      >
                        {subtitle.text}
                      </span>
                    )}
                  </button>
                ) : (
                  <div className="flex-1 min-w-0">
                    <span className="block text-base font-semibold truncate">
                      {cat.emoji && (
                        <span aria-hidden className="mr-1.5">
                          {cat.emoji}
                        </span>
                      )}
                      {cat.name}
                    </span>
                    {subtitle && (
                      <span
                        className={`mt-0.5 block text-xs truncate ${
                          subtitle.underfunded
                            ? "text-amber-400"
                            : "text-fg/55"
                        }`}
                      >
                        {subtitle.text}
                      </span>
                    )}
                  </div>
                )}
                {!editMode && (
                  <>
                    <button
                      type="button"
                      onClick={() => togglePin(cat.id)}
                      aria-label={
                        pinned ? `Unpin ${cat.name}` : `Pin ${cat.name}`
                      }
                      aria-pressed={pinned}
                      className="grid h-7 w-7 place-items-center"
                    >
                      <Pin
                        size={14}
                        strokeWidth={2}
                        className={pinned ? "text-mint" : "text-fg/30"}
                        fill={pinned ? "currentColor" : "transparent"}
                      />
                    </button>
                    <Link
                      href={targetHref}
                      aria-label={
                        target
                          ? `Edit target for ${cat.name}`
                          : `Set target for ${cat.name}`
                      }
                      className="grid h-7 w-7 place-items-center"
                    >
                      <Target
                        size={14}
                        strokeWidth={2}
                        className={target ? "text-mint" : "text-fg/30"}
                      />
                    </Link>
                    <AssignedCell
                      value={getAssigned(assignments, monthKey, cat.id)}
                      ariaLabel={`Assigned to ${cat.name}`}
                      onCommit={(next) =>
                        setAssignment(monthKey, cat.id, next)
                      }
                    />
                    {(() => {
                      const av = categoryAvailable(
                        cat,
                        assignments,
                        transactions,
                        monthKey,
                        ccCtx,
                      );
                      // When overspent, the tap target jumps to the
                      // move form pre-pointed AT this category with the
                      // deficit amount — a one-tap "cover overspending"
                      // shortcut.
                      const href =
                        av < 0
                          ? `/budget/move?to=${encodeURIComponent(cat.id)}&month=${monthKey}&amount=${Math.abs(av).toFixed(2)}`
                          : `/budget/move?from=${encodeURIComponent(cat.id)}&month=${monthKey}`;
                      const ariaLabel =
                        av < 0
                          ? `Cover overspending in ${cat.name}`
                          : `Move money for ${cat.name}`;
                      return (
                        <Link
                          href={href}
                          aria-label={ariaLabel}
                          className="w-24 text-right"
                        >
                          <AvailablePill amount={av} />
                        </Link>
                      );
                    })()}
                  </>
                )}
                {editMode && (
                  <button
                    type="button"
                    onClick={() => {
                      if (
                        window.confirm(
                          `Delete "${cat.name}"? Its assignments, target, and pin are removed; existing transactions stay tagged with this name.`,
                        )
                      ) {
                        markUndoable(`Category "${cat.name}" deleted`);
                        deleteCategory(cat.id);
                      }
                    }}
                    aria-label={`Delete category ${cat.name}`}
                    className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-rose-400/70 hover:text-rose-400"
                  >
                    <Trash2 size={14} strokeWidth={2.4} />
                  </button>
                )}
              </li>
            );
          })}

          {editMode && (
            <li className="flex items-center gap-2 bg-list-row px-4 py-3">
              <form
                onSubmit={submitNewCategory}
                className="flex flex-1 items-center gap-2"
              >
                <input
                  type="text"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  placeholder={`Add a category to ${group.name}`}
                  className="flex-1 rounded-md bg-card-elevated px-3 py-2 text-sm outline-none placeholder:text-fg/40"
                />
                <button
                  type="submit"
                  aria-label={`Add category to ${group.name}`}
                  className="grid h-9 w-9 place-items-center rounded-full bg-accent/20 text-accent"
                >
                  <Plus size={16} strokeWidth={2.5} />
                </button>
              </form>
            </li>
          )}
        </ul>
      )}
    </section>
  );
}
