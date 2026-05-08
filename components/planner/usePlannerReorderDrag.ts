"use client";

import {
  useCallback,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";

const TOUCH_LONG_PRESS_MS = 280;
// If the user moves their finger by more than this many pixels before
// the long-press fires, we treat it as a scroll attempt and cancel
// arming so the grip doesn't accidentally hijack a scroll.
const ARM_CANCEL_PX = 8;

type DragState = { id: string; date: string };

type Options = {
  onReorder: (sourceId: string, targetId: string) => void;
};

// Pointer-events powered drag handle. Mouse drags arm immediately
// (matches the desktop muscle memory) while touch drags require a
// short hold first so the page can still be scrolled normally. Drop
// targets are hit-tested via `document.elementFromPoint`, looking for
// `data-planner-entry` and `data-planner-date` on a parent element.
export function usePlannerReorderDrag({ onReorder }: Options) {
  const [drag, setDrag] = useState<DragState | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);

  // Most state lives in refs so the re-renders we trigger when the drop
  // target changes don't blow away the in-progress gesture.
  const armTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const armedRef = useRef(false);
  const sourceRef = useRef<DragState | null>(null);
  const startXRef = useRef(0);
  const startYRef = useRef(0);
  const dropTargetIdRef = useRef<string | null>(null);

  const endGesture = useCallback(() => {
    if (armTimerRef.current !== null) {
      clearTimeout(armTimerRef.current);
      armTimerRef.current = null;
    }
    armedRef.current = false;
    sourceRef.current = null;
    dropTargetIdRef.current = null;
    setDrag(null);
    setDropTargetId(null);
  }, []);

  const gripProps = useCallback(
    (id: string, date: string) => ({
      // touch-action:none keeps the browser from claiming the touch as a
      // scroll before our long-press has a chance to arm.
      style: { touchAction: "none" } as CSSProperties,
      onPointerDown(e: ReactPointerEvent<HTMLElement>) {
        if (e.pointerType === "mouse" && e.button !== 0) return;
        try {
          e.currentTarget.setPointerCapture(e.pointerId);
        } catch {
          // setPointerCapture can throw if the pointer's already gone;
          // proceed with the gesture anyway.
        }
        sourceRef.current = { id, date };
        startXRef.current = e.clientX;
        startYRef.current = e.clientY;
        armedRef.current = false;

        const arm = () => {
          armTimerRef.current = null;
          armedRef.current = true;
          setDrag({ id, date });
          if (typeof navigator !== "undefined" && "vibrate" in navigator) {
            try {
              navigator.vibrate(20);
            } catch {
              // Vibration is gated behind user-gesture rules in some
              // browsers; a silent failure is fine.
            }
          }
        };

        if (e.pointerType === "touch") {
          armTimerRef.current = setTimeout(arm, TOUCH_LONG_PRESS_MS);
        } else {
          arm();
        }
      },
      onPointerMove(e: ReactPointerEvent<HTMLElement>) {
        if (!sourceRef.current) return;
        const dx = e.clientX - startXRef.current;
        const dy = e.clientY - startYRef.current;
        if (!armedRef.current) {
          if (Math.hypot(dx, dy) > ARM_CANCEL_PX) {
            endGesture();
          }
          return;
        }
        const hit = document.elementFromPoint(e.clientX, e.clientY);
        const li = hit?.closest("[data-planner-entry]") as HTMLElement | null;
        const targetId = li?.dataset.plannerEntry ?? null;
        const targetDate = li?.dataset.plannerDate ?? null;
        const source = sourceRef.current;
        if (
          targetId &&
          targetDate === source.date &&
          targetId !== source.id
        ) {
          if (dropTargetIdRef.current !== targetId) {
            dropTargetIdRef.current = targetId;
            setDropTargetId(targetId);
          }
        } else if (dropTargetIdRef.current !== null) {
          dropTargetIdRef.current = null;
          setDropTargetId(null);
        }
      },
      onPointerUp() {
        const source = sourceRef.current;
        const dropId = dropTargetIdRef.current;
        if (armedRef.current && source && dropId && dropId !== source.id) {
          onReorder(source.id, dropId);
        }
        endGesture();
      },
      onPointerCancel() {
        endGesture();
      },
    }),
    [endGesture, onReorder],
  );

  return { drag, dropTargetId, gripProps };
}
