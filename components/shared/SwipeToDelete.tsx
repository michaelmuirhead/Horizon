"use client";

import {
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { Trash2 } from "lucide-react";

// Threshold past which we lock the gesture as a horizontal swipe (anything
// less and we treat it as a tap or a vertical scroll).
const HORIZONTAL_LOCK = 8;
// How far the row sits open after a partial swipe — this is the rest
// position where the delete button is fully visible.
const REVEAL_PX = 96;
// Past this, releasing commits the delete immediately ("fly-out").
const COMMIT_PX = 180;

type Props = {
  // Called once a delete is committed (either via the revealed button or
  // a hard fly-out swipe). The component handles its own state cleanup.
  onDelete: () => void;
  ariaLabel: string;
  // Synchronous gate before delete; return false to abort and snap closed.
  // Used by reconciled rows to prompt a confirm.
  confirmBeforeDelete?: () => boolean;
  // When true, the swipe behavior is bypassed and children render plainly
  // (e.g. inside bulk-select where swipe would conflict with toggle).
  disabled?: boolean;
  children: ReactNode;
};

export default function SwipeToDelete({
  onDelete,
  ariaLabel,
  confirmBeforeDelete,
  disabled,
  children,
}: Props) {
  // Mid-gesture finger tracking is in `dragX`; `revealed` is the snapped
  // open state after release. `animating` toggles the CSS transition so the
  // visual snap glides while the active drag tracks the finger 1:1.
  const [dragX, setDragX] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [animating, setAnimating] = useState(true);
  const startX = useRef<number | null>(null);
  const startY = useRef<number | null>(null);
  const dragging = useRef(false);
  // After a real swipe we have to swallow the click that fires when the
  // user lifts their finger over the underlying interactive child —
  // otherwise a swipe-then-release also navigates / activates.
  const suppressClickRef = useRef(false);

  function commitDelete() {
    if (confirmBeforeDelete && !confirmBeforeDelete()) {
      // User backed out of the confirm — slide closed and stop here.
      setRevealed(false);
      setAnimating(true);
      setDragX(0);
      return;
    }
    onDelete();
  }

  function snapClosed() {
    setRevealed(false);
    setAnimating(true);
    setDragX(0);
  }

  function snapOpen() {
    setRevealed(true);
    setAnimating(true);
    setDragX(-REVEAL_PX);
  }

  function onPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    if (disabled) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    startX.current = e.clientX;
    startY.current = e.clientY;
    dragging.current = false;
    setAnimating(false);
  }

  function onPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    if (disabled) return;
    if (startX.current === null || startY.current === null) return;
    const dx = e.clientX - startX.current;
    const dy = e.clientY - startY.current;
    if (!dragging.current) {
      if (Math.abs(dx) < HORIZONTAL_LOCK && Math.abs(dy) < HORIZONTAL_LOCK) {
        return;
      }
      if (Math.abs(dy) > Math.abs(dx)) {
        startX.current = null;
        startY.current = null;
        return;
      }
      dragging.current = true;
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        // setPointerCapture can throw on some browsers if the pointer is gone.
      }
    }
    // Allow leftward drag from closed (0 → −COMMIT) or further-left drag from
    // open (−REVEAL → −COMMIT). Rightward drag from open closes the row.
    const baseline = revealed ? -REVEAL_PX : 0;
    const next = Math.max(-COMMIT_PX - 40, Math.min(0, baseline + dx));
    setDragX(next);
  }

  function onPointerUp() {
    if (disabled) return;
    if (dragging.current) {
      suppressClickRef.current = true;
      if (dragX <= -COMMIT_PX * 0.85) {
        // Hard fly-out — animate offscreen and trigger delete on next frame.
        setAnimating(true);
        setDragX(-2000);
        requestAnimationFrame(() => commitDelete());
      } else if (dragX < -REVEAL_PX / 2) {
        snapOpen();
      } else {
        snapClosed();
      }
    } else {
      setAnimating(true);
    }
    startX.current = null;
    startY.current = null;
    dragging.current = false;
  }

  function onClickCapture(e: React.MouseEvent) {
    if (suppressClickRef.current) {
      e.preventDefault();
      e.stopPropagation();
      suppressClickRef.current = false;
      return;
    }
    // Plain tap on the row body while the delete is revealed should close
    // it rather than navigate.
    if (revealed) {
      e.preventDefault();
      e.stopPropagation();
      snapClosed();
    }
  }

  if (disabled) {
    return <>{children}</>;
  }

  return (
    <div className="relative overflow-hidden bg-rose-700/90">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          commitDelete();
        }}
        aria-label={ariaLabel}
        tabIndex={revealed ? 0 : -1}
        className="absolute inset-y-0 right-0 flex w-24 items-center justify-center gap-1.5 text-sm font-bold text-white"
      >
        <Trash2 size={16} strokeWidth={2.4} />
        Delete
      </button>
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onClickCapture={onClickCapture}
        // touch-action: pan-y lets the page keep scrolling vertically while
        // we own the horizontal axis for swipe.
        style={{
          transform: `translateX(${dragX}px)`,
          transition: animating ? "transform 200ms ease-out" : "none",
          touchAction: "pan-y",
        }}
      >
        {children}
      </div>
    </div>
  );
}
