"use client";

import Link from "next/link";
import {
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { Check, Copy, Pencil, Trash2 } from "lucide-react";
import type { PlannerEntry } from "@/lib/planner";
import { formatPlannerDate } from "@/lib/planner";
import { formatCurrency } from "@/lib/format";
import RowMenu from "@/components/planner/RowMenu";

type Props = {
  entry: PlannerEntry;
  // Cumulative budget balance after this entry posted, walking the
  // budget's entries in stored order.
  runningBalance: number;
  href: string;
  onTogglePaid: () => void;
  onDelete: () => void;
  onDuplicate?: () => void;
  // Optional element rendered to the left of the row body — the ledger
  // page passes a draggable grip when reorder is enabled.
  dragHandle?: ReactNode;
};

// How far the user has to swipe before we lock the gesture as a
// horizontal swipe (anything less reads as a tap or vertical scroll).
const HORIZONTAL_LOCK = 8;
// How far past the resting state a release commits the toggle.
const COMMIT_PX = 96;
// Maximum visual offset — past this we let the reveal hold open
// while the user keeps dragging, but the row stops moving.
const MAX_PULL_PX = 160;

export default function PlannerEntryRow({
  entry,
  runningBalance,
  href,
  onTogglePaid,
  onDelete,
  onDuplicate,
  dragHandle,
}: Props) {
  const isIncome = entry.amount > 0;
  const paid = Boolean(entry.paid);

  const labelTone = isIncome ? "text-emerald-400" : "text-rose-400";
  const amountTone = isIncome ? "text-emerald-400" : "text-rose-400";
  const runningTone = runningBalance < 0 ? "text-rose-300" : "text-emerald-400";
  const dateTone = paid ? "text-amber-400" : "text-fg/45";

  const amountStr = isIncome
    ? `+ ${formatCurrency(entry.amount)}`
    : `− ${formatCurrency(Math.abs(entry.amount))}`;
  const runningStr =
    runningBalance < 0
      ? `− ${formatCurrency(Math.abs(runningBalance))}`
      : `+ ${formatCurrency(runningBalance)}`;

  // Swipe-left to toggle paid. We track the gesture inline so the row
  // doesn't need a heavier swipe wrapper — only the link/center area
  // listens, which keeps the grip's drag-to-reorder and the kebab
  // menu untouched.
  const [dragX, setDragX] = useState(0);
  const [animating, setAnimating] = useState(true);
  const startXRef = useRef<number | null>(null);
  const startYRef = useRef<number | null>(null);
  const lockedRef = useRef(false);
  const suppressClickRef = useRef(false);

  function endSwipe(commit: boolean) {
    if (commit) {
      // Trigger the toggle next frame so the snap-back animation is
      // visible before paid state flips and the row re-renders.
      requestAnimationFrame(() => onTogglePaid());
    }
    setAnimating(true);
    setDragX(0);
    startXRef.current = null;
    startYRef.current = null;
    lockedRef.current = false;
  }

  function onPointerDown(e: ReactPointerEvent<HTMLAnchorElement>) {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    startXRef.current = e.clientX;
    startYRef.current = e.clientY;
    lockedRef.current = false;
    setAnimating(false);
  }

  function onPointerMove(e: ReactPointerEvent<HTMLAnchorElement>) {
    if (startXRef.current === null || startYRef.current === null) return;
    const dx = e.clientX - startXRef.current;
    const dy = e.clientY - startYRef.current;
    if (!lockedRef.current) {
      if (Math.abs(dx) < HORIZONTAL_LOCK && Math.abs(dy) < HORIZONTAL_LOCK) {
        return;
      }
      if (Math.abs(dy) > Math.abs(dx) || dx > 0) {
        // Vertical scroll or rightward drag — bow out so the page can
        // scroll normally and the link click still fires on release.
        startXRef.current = null;
        startYRef.current = null;
        return;
      }
      lockedRef.current = true;
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        // setPointerCapture can throw on some browsers if the pointer
        // is gone; we still get pointermove via touch-action: pan-y.
      }
    }
    const offset = Math.max(-MAX_PULL_PX, Math.min(0, dx));
    setDragX(offset);
  }

  function onPointerUp() {
    if (lockedRef.current) {
      suppressClickRef.current = true;
      const commit = dragX <= -COMMIT_PX;
      endSwipe(commit);
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

  const linkStyle: CSSProperties = {
    transform: `translateX(${dragX}px)`,
    transition: animating ? "transform 200ms ease-out" : "none",
    touchAction: "pan-y",
  };

  const revealLabel = paid ? "Unpaid" : "Paid";
  const revealActive = dragX <= -COMMIT_PX;

  return (
    <div className="flex w-full items-stretch bg-card">
      {dragHandle}
      <div className="relative flex-1 min-w-0 overflow-hidden">
        <div
          aria-hidden
          className={`absolute inset-y-0 right-0 flex w-28 items-center justify-end pr-4 text-sm font-bold transition-colors ${
            revealActive
              ? "bg-amber-500/30 text-amber-100"
              : "bg-amber-500/15 text-amber-300/80"
          }`}
        >
          <Check size={14} className="mr-1" strokeWidth={2.6} />
          {revealLabel}
        </div>
        <Link
          href={href}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onClickCapture={onClickCapture}
          style={linkStyle}
          className="relative flex items-center gap-3 bg-card px-3 py-3 min-w-0"
        >
          <div className="flex-1 min-w-0">
            <p
              className={`truncate text-base font-bold ${labelTone} ${
                paid ? "line-through opacity-60" : ""
              }`}
            >
              {entry.label}
            </p>
          </div>
          <div className="text-right shrink-0 min-w-[5.5rem]">
            <span
              className={`block text-base font-bold tabular-nums ${amountTone} ${
                paid ? "line-through opacity-60" : ""
              }`}
            >
              {amountStr}
            </span>
            <span
              className={`mt-0.5 inline-block rounded-md px-1.5 py-0.5 text-[11px] font-bold tabular-nums ${runningTone} ${
                runningBalance < 0 ? "bg-rose-500/10" : "bg-emerald-500/10"
              }`}
            >
              {runningStr}
            </span>
          </div>
          <div
            className={`text-right shrink-0 w-16 text-xs font-semibold leading-tight ${dateTone}`}
          >
            {entry.date ? (
              formatPlannerDate(entry.date)
            ) : (
              <span className="text-fg/40">Date</span>
            )}
          </div>
        </Link>
      </div>
      <RowMenu
        ariaLabel={`Actions for ${entry.label}`}
        items={[
          {
            label: paid ? "Mark unpaid" : "Mark paid",
            icon: <Check size={14} />,
            onClick: onTogglePaid,
          },
          ...(onDuplicate
            ? [
                {
                  label: "Duplicate",
                  icon: <Copy size={14} />,
                  onClick: onDuplicate,
                },
              ]
            : []),
          {
            label: "Edit",
            icon: <Pencil size={14} />,
            onClick: () => {
              window.location.href = href;
            },
          },
          {
            label: "Delete",
            icon: <Trash2 size={14} />,
            destructive: true,
            onClick: onDelete,
          },
        ]}
      />
    </div>
  );
}
