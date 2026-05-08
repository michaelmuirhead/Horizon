"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";

// CSS transition applied to non-source rows so they glide in and out as
// the user drags, instead of snapping. The source row uses no transition
// so its position tracks the pointer 1:1.
const SHIFT_TRANSITION = "transform 200ms ease-out";

// Inline styles set on the grip button. iOS Safari needs the -webkit-
// prefixed callout/user-select rules to suppress the long-press magnifier
// and text-selection callout, both of which can otherwise abort the
// gesture mid-drag with a pointercancel.
const GRIP_STYLE: CSSProperties = {
  touchAction: "none",
  WebkitTouchCallout: "none",
  WebkitUserSelect: "none",
  userSelect: "none",
};

type RowGeom = {
  id: string;
  // Viewport-y top at drag-arm time. Pointer events report clientY in
  // viewport coordinates, so comparing against `top` is consistent.
  top: number;
  height: number;
  // Index within the day group's <ul> at arm time.
  index: number;
};

type DragGeom = {
  sourceId: string;
  date: string;
  rows: RowGeom[];
  sourceIndex: number;
  sourceHeight: number;
  // Captured pointer Y at arm time so deltaY = (current y) - startY.
  startY: number;
  // The pointerId we're tracking. Document listeners may receive other
  // pointer events (multi-touch); we filter on this to ignore them.
  pointerId: number;
};

type DragView = {
  sourceId: string;
  date: string;
  // Pixel offset to apply to the source row's <li> via translateY.
  translateY: number;
  // Per-non-source-row pixel offset, keyed by entry id.
  shifts: Record<string, number>;
  // Reduced-array index where source would land if dropped now. nonSource
  // length means "after the last non-source row".
  targetReducedIndex: number;
};

type Options = {
  onReorder: (
    sourceId: string,
    targetId: string,
    position: "before" | "after",
  ) => void;
};

// Pointer-events powered drag with live row-shift previews. The grip is
// a dedicated 28px handle so we arm immediately on pointerdown for both
// mouse and touch. Move/end listeners are attached on `document` rather
// than the grip element — iOS Safari (and the standalone PWA shell built
// on WKWebView) doesn't reliably honor `setPointerCapture` for touch
// pointers, so without document-level listeners the move events stop
// firing as soon as the finger leaves the small grip area.
export function usePlannerReorderDrag({ onReorder }: Options) {
  const [view, setView] = useState<DragView | null>(null);

  const armedRef = useRef(false);
  const geomRef = useRef<DragGeom | null>(null);
  const targetReducedRef = useRef<number>(-1);
  // Refs for the document-level listeners — needed so the pointerdown
  // handler can install them and the cleanup can find the same fns.
  const moveHandlerRef = useRef<((e: PointerEvent) => void) | null>(null);
  const endHandlerRef = useRef<((e: PointerEvent) => void) | null>(null);

  const detachDocListeners = useCallback(() => {
    if (moveHandlerRef.current) {
      document.removeEventListener("pointermove", moveHandlerRef.current);
      moveHandlerRef.current = null;
    }
    if (endHandlerRef.current) {
      document.removeEventListener("pointerup", endHandlerRef.current);
      document.removeEventListener("pointercancel", endHandlerRef.current);
      endHandlerRef.current = null;
    }
  }, []);

  const endGesture = useCallback(() => {
    detachDocListeners();
    armedRef.current = false;
    geomRef.current = null;
    targetReducedRef.current = -1;
    setView(null);
  }, [detachDocListeners]);

  // Always clean up document listeners if the component unmounts mid-drag.
  useEffect(() => {
    return () => {
      detachDocListeners();
    };
  }, [detachDocListeners]);

  const captureGeometry = useCallback(
    (
      gripEl: HTMLElement,
      sourceId: string,
      date: string,
      startY: number,
      pointerId: number,
    ) => {
      const li = gripEl.closest<HTMLElement>("[data-planner-entry]");
      if (!li) return null;
      const ul = li.parentElement;
      if (!ul) return null;
      const liEls = Array.from(
        ul.querySelectorAll<HTMLElement>(":scope > [data-planner-entry]"),
      );
      const rows: RowGeom[] = liEls.map((el, idx) => {
        const r = el.getBoundingClientRect();
        return {
          id: el.dataset.plannerEntry ?? "",
          top: r.top,
          height: r.height,
          index: idx,
        };
      });
      const sourceIndex = rows.findIndex((r) => r.id === sourceId);
      if (sourceIndex < 0) return null;
      const geom: DragGeom = {
        sourceId,
        date,
        rows,
        sourceIndex,
        sourceHeight: rows[sourceIndex].height,
        startY,
        pointerId,
      };
      geomRef.current = geom;
      return geom;
    },
    [],
  );

  const computeView = useCallback((deltaY: number): DragView | null => {
    const geom = geomRef.current;
    if (!geom) return null;
    const sourceRow = geom.rows[geom.sourceIndex];
    const sourceCenter = sourceRow.top + sourceRow.height / 2 + deltaY;

    let count = 0;
    for (const r of geom.rows) {
      if (r.id === geom.sourceId) continue;
      if (r.top + r.height / 2 < sourceCenter) count++;
    }
    const targetReduced = count;

    const shifts: Record<string, number> = {};
    for (const r of geom.rows) {
      if (r.id === geom.sourceId) continue;
      const reducedIdx =
        r.index < geom.sourceIndex ? r.index : r.index - 1;
      const removal = r.index > geom.sourceIndex ? -geom.sourceHeight : 0;
      const reinsertion =
        reducedIdx >= targetReduced ? geom.sourceHeight : 0;
      shifts[r.id] = removal + reinsertion;
    }

    targetReducedRef.current = targetReduced;
    return {
      sourceId: geom.sourceId,
      date: geom.date,
      translateY: deltaY,
      shifts,
      targetReducedIndex: targetReduced,
    };
  }, []);

  const commitDropFromGesture = useCallback(() => {
    const geom = geomRef.current;
    if (!armedRef.current || !geom) return;
    const targetReduced = targetReducedRef.current;
    if (targetReduced < 0 || targetReduced === geom.sourceIndex) return;
    const nonSource = geom.rows.filter((r) => r.id !== geom.sourceId);
    if (targetReduced < nonSource.length) {
      onReorder(geom.sourceId, nonSource[targetReduced].id, "before");
    } else if (nonSource.length > 0) {
      // Past the last row — pin to the trailing edge so source ends up
      // at the very bottom of the day.
      onReorder(
        geom.sourceId,
        nonSource[nonSource.length - 1].id,
        "after",
      );
    }
  }, [onReorder]);

  const gripProps = useCallback(
    (id: string, date: string) => ({
      style: GRIP_STYLE,
      onPointerDown(e: ReactPointerEvent<HTMLElement>) {
        if (e.pointerType === "mouse" && e.button !== 0) return;
        // preventDefault tells iOS Safari "this gesture is mine" so it
        // doesn't try to start a system scroll/select.
        e.preventDefault();
        const grip = e.currentTarget;
        const geom = captureGeometry(
          grip,
          id,
          date,
          e.clientY,
          e.pointerId,
        );
        if (!geom) return;
        armedRef.current = true;
        const next = computeView(0);
        if (next) setView(next);
        if (typeof navigator !== "undefined" && "vibrate" in navigator) {
          try {
            navigator.vibrate(15);
          } catch {
            // Vibration is gated behind user-gesture rules in some
            // browsers; a silent failure is fine. (iOS Safari has no
            // vibrate API at all — try/catch covers the missing fn.)
          }
        }

        // Install document-level listeners so we keep getting move/end
        // events even when the finger leaves the grip's 28px footprint.
        // Non-passive so the move handler can preventDefault and stop
        // iOS from interpreting the drag as a scroll.
        const onMove = (ev: PointerEvent) => {
          const g = geomRef.current;
          if (!g || ev.pointerId !== g.pointerId) return;
          ev.preventDefault();
          const nextView = computeView(ev.clientY - g.startY);
          if (nextView) setView(nextView);
        };
        const onEnd = (ev: PointerEvent) => {
          const g = geomRef.current;
          if (!g || ev.pointerId !== g.pointerId) return;
          if (ev.type === "pointerup") commitDropFromGesture();
          endGesture();
        };
        moveHandlerRef.current = onMove;
        endHandlerRef.current = onEnd;
        document.addEventListener("pointermove", onMove, { passive: false });
        document.addEventListener("pointerup", onEnd);
        document.addEventListener("pointercancel", onEnd);
      },
    }),
    [captureGeometry, commitDropFromGesture, computeView, endGesture],
  );

  const rowStyle = useCallback(
    (id: string): CSSProperties | undefined => {
      if (!view) return undefined;
      if (view.sourceId === id) {
        return {
          transform: `translateY(${view.translateY}px)`,
          transition: "none",
          position: "relative",
          zIndex: 10,
          boxShadow: "0 14px 28px -8px rgba(0, 0, 0, 0.5)",
          cursor: "grabbing",
          touchAction: "none",
        };
      }
      const shift = view.shifts[id] ?? 0;
      return {
        transform: `translateY(${shift}px)`,
        transition: SHIFT_TRANSITION,
        position: "relative",
      };
    },
    [view],
  );

  return {
    drag: view ? { sourceId: view.sourceId, date: view.date } : null,
    rowStyle,
    gripProps,
  };
}
