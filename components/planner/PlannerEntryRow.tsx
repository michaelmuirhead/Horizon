"use client";

import Link from "next/link";
import {
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { Check, Trash2 } from "lucide-react";
import type { PlannerEntry } from "@/lib/planner";
import { formatPlannerDate } from "@/lib/planner";
import { formatCurrency } from "@/lib/format";
import { useHorizonStore } from "@/components/store/HorizonStore";
import SwipeToDelete from "@/components/shared/SwipeToDelete";

type Props = {
  entry: PlannerEntry;
  // Cumulative budget balance after this entry posted (Fudget-style).
  runningBalance?: number;
  // Click target. Defaults to the legacy /planner/{id} edit route, but
  // pages inside the folder/budget hierarchy override this with the
  // full nested path.
  href?: string;
  // Toggling clears/uncovers the entry. Optional so the legacy month
  // view can still render rows without the cleared affordance.
  onTogglePaid?: () => void;
  // Optional override for delete. When provided, the row renders plain
  // (no SwipeToDelete) and the page is expected to wire delete via a
  // row menu. When omitted, the row falls back to the legacy
  // SwipeToDelete + store.deletePlannerEntry flow.
  onDelete?: () => void;
  // Drag handle node rendered on the leading edge of the row. Pages
  // building reorder UIs pass the grip button in here.
  dragHandle?: ReactNode;
};

// How far the user has to swipe before we lock the gesture as a
// horizontal swipe (anything less reads as a tap or vertical scroll).
const HORIZONTAL_LOCK = 8;
// How far past resting state a release commits the action.
const COMMIT_PX = 96;
// Ceiling on the visible offset — past this the row stops moving so
// the reveal pane doesn't disappear off-screen.
const MAX_PULL_PX = 160;

export default function PlannerEntryRow({
  entry,
  runningBalance,
  href,
  onTogglePaid,
  onDelete,
  dragHandle,
}: Props) {
  const { deletePlannerEntry, markUndoable } = useHorizonStore();
  const isIncome = entry.amount > 0;
  const display = isIncome
    ? `+${formatCurrency(entry.amount)}`
    : `−${formatCurrency(Math.abs(entry.amount))}`;

  const target = href ?? `/planner/${entry.id}`;
  const paid = !!entry.paid;

  function handleLegacyDelete() {
    markUndoable(`Entry "${entry.label}" deleted`);
    deletePlannerEntry(entry.id);
  }

  // Swipe horizontally to act on the row inline. Left = toggle paid,
  // right = delete. The gesture is only wired when both onTogglePaid
  // and onDelete are passed; legacy callers without those still get
  // the SwipeToDelete fallback at the bottom of this file.
  const swipeEnabled = Boolean(onTogglePaid && onDelete);
  const [dragX, setDragX] = useState(0);
  const [animating, setAnimating] = useState(true);
  const startXRef = useRef<number | null>(null);
  const startYRef = useRef<number | null>(null);
  const lockedRef = useRef(false);
  const suppressClickRef = useRef(false);

  function endSwipe(action: "paid" | "delete" | null) {
    if (action === "paid" && onTogglePaid) {
      // Fire next frame so the snap-back animation is visible before
      // paid state flips and the row re-renders.
      requestAnimationFrame(() => onTogglePaid());
    } else if (action === "delete" && onDelete) {
      requestAnimationFrame(() => onDelete());
    }
    setAnimating(true);
    setDragX(0);
    startXRef.current = null;
    startYRef.current = null;
    lockedRef.current = false;
  }

  function onPointerDown(e: ReactPointerEvent<HTMLAnchorElement>) {
    if (!swipeEnabled) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    startXRef.current = e.clientX;
    startYRef.current = e.clientY;
    lockedRef.current = false;
    setAnimating(false);
  }

  function onPointerMove(e: ReactPointerEvent<HTMLAnchorElement>) {
    if (!swipeEnabled) return;
    if (startXRef.current === null || startYRef.current === null) return;
    const dx = e.clientX - startXRef.current;
    const dy = e.clientY - startYRef.current;
    if (!lockedRef.current) {
      if (Math.abs(dx) < HORIZONTAL_LOCK && Math.abs(dy) < HORIZONTAL_LOCK) {
        return;
      }
      if (Math.abs(dy) > Math.abs(dx)) {
        // Vertical scroll — bow out so the page can scroll normally
        // and the link click still fires on release.
        startXRef.current = null;
        startYRef.current = null;
        return;
      }
      lockedRef.current = true;
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        // setPointerCapture can throw if the pointer is gone; we still
        // get pointermove via touch-action: pan-y on the link.
      }
    }
    const offset = Math.max(-MAX_PULL_PX, Math.min(MAX_PULL_PX, dx));
    setDragX(offset);
  }

  function onPointerUp() {
    if (!swipeEnabled) return;
    if (lockedRef.current) {
      suppressClickRef.current = true;
      const action: "paid" | "delete" | null =
        dragX <= -COMMIT_PX
          ? "paid"
          : dragX >= COMMIT_PX
            ? "delete"
            : null;
      endSwipe(action);
    } else {
      setAnimating(true);
      startXRef.current = null;
      startYRef.current = null;
    }
  }

  function onClickCapture(e: React.MouseEvent) {
    if (suppressClickRef.current) {
      e.preventDefault();
      e.stopPropagation();
      suppressClickRef.current = false;
    }
  }

  // Apply the same translateX to the whole sliding container so the
  // grip + checkbox + link travel together. Reveal panes sit behind in
  // absolute layers — they don't move.
  const slideStyle: CSSProperties = swipeEnabled
    ? {
        transform: `translateX(${dragX}px)`,
        transition: animating ? "transform 200ms ease-out" : "none",
      }
    : {};

  const paidLabel = paid ? "Unpaid" : "Paid";
  const paidActive = dragX <= -COMMIT_PX;
  const deleteActive = dragX >= COMMIT_PX;
  const showPaidPane = dragX < 0;
  const showDeletePane = dragX > 0;

  const body = (
    <div className="relative overflow-hidden bg-card">
      {swipeEnabled && (
        <>
          {/* Right edge: revealed when user swipes LEFT (mark paid). */}
          <div
            aria-hidden
            className={`pointer-events-none absolute inset-y-0 right-0 flex w-28 items-center justify-end pr-4 text-sm font-bold transition-opacity ${
              paidActive
                ? "bg-amber-500/30 text-amber-100"
                : "bg-amber-500/15 text-amber-300/80"
            } ${showPaidPane ? "opacity-100" : "opacity-0"}`}
          >
            <Check size={14} className="mr-1" strokeWidth={2.6} />
            {paidLabel}
          </div>
          {/* Left edge: revealed when user swipes RIGHT (delete). */}
          <div
            aria-hidden
            className={`pointer-events-none absolute inset-y-0 left-0 flex w-28 items-center justify-start pl-4 text-sm font-bold transition-opacity ${
              deleteActive
                ? "bg-rose-500/40 text-rose-100"
                : "bg-rose-500/20 text-rose-200/80"
            } ${showDeletePane ? "opacity-100" : "opacity-0"}`}
          >
            <Trash2 size={14} className="mr-1" strokeWidth={2.6} />
            Delete
          </div>
        </>
      )}
      <div
        className="relative flex w-full items-center gap-2 bg-card pr-2"
        style={slideStyle}
      >
        {dragHandle}
        {onTogglePaid && (
          <button
            type="button"
            aria-pressed={paid}
            aria-label={paid ? "Mark as not paid" : "Mark as paid"}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onTogglePaid();
            }}
            className={`ml-2 grid h-5 w-5 place-items-center rounded-full border ${
              paid
                ? "border-emerald-400 bg-emerald-400/15 text-emerald-400"
                : "border-fg/30 text-transparent"
            }`}
          >
            <Check size={12} strokeWidth={3} />
          </button>
        )}
        <Link
          href={target}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onClickCapture={onClickCapture}
          style={swipeEnabled ? { touchAction: "pan-y" } : undefined}
          className="flex flex-1 min-w-0 items-center gap-3 py-3.5 pl-4"
        >
          <div className="flex-1 min-w-0">
            <p
              className={`text-base font-semibold truncate ${paid ? "line-through text-fg/55" : ""}`}
            >
              {entry.label}
            </p>
            <p
              className={`mt-0.5 text-xs ${entry.date ? "text-fg/55" : "text-fg/40"}`}
            >
              {entry.date ? formatPlannerDate(entry.date) : "Date"}
            </p>
          </div>
          <div className="text-right shrink-0">
            <span
              className={`block text-base font-bold tabular-nums ${
                isIncome ? "text-emerald-400" : "text-rose-400"
              } ${paid ? "opacity-60" : ""}`}
            >
              {display}
            </span>
            {runningBalance !== undefined && (
              <span
                className={`mt-0.5 block text-[11px] font-semibold tabular-nums ${
                  runningBalance < 0 ? "text-rose-300" : "text-fg/55"
                }`}
              >
                {formatCurrency(runningBalance)}
              </span>
            )}
          </div>
        </Link>
      </div>
    </div>
  );

  // New callers (folder/budget pages) handle delete via a row menu and
  // pass an onDelete prop — render plain so we don't double up on the
  // delete affordance.
  if (onDelete) return body;

  return (
    <SwipeToDelete
      onDelete={handleLegacyDelete}
      ariaLabel={`Delete entry ${entry.label}`}
    >
      {body}
    </SwipeToDelete>
  );
}
