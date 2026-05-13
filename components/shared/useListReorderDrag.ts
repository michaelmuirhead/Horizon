"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";

// Generic pointer-events reorder hook for simple vertical lists like
// the home-layout customize page. Deliberately lighter than the
// planner's drag — no live row-shift preview, just a floating source
// row plus a thin highlight line where the drop will land. Good enough
// for low-frequency config UIs; the planner gets the fancier version
// because it's used during everyday entry editing.
//
// Rows must carry the `data-{dataAttribute}` attribute on their <li>
// (or whatever container element) so we can measure them at drag-start
// without prop-drilling refs through every list item.

const SHIFT_TRANSITION = "transform 180ms ease-out";

type RowGeom = { id: string; top: number; height: number; index: number };

type DragGeom = {
  sourceId: string;
  sourceIndex: number;
  sourceHeight: number;
  startY: number;
  pointerId: number;
  rows: RowGeom[];
};

type Options = {
  onReorder: (sourceIndex: number, targetIndex: number) => void;
  // CSS attribute (without the "data-" prefix) on each row's <li>
  // container. Defaults to "list-row" so callers can use the hook with
  // any ad-hoc list without colliding with other reorder systems.
  dataAttribute?: string;
};

export function useListReorderDrag({
  onReorder,
  dataAttribute = "list-row",
}: Options) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [translateY, setTranslateY] = useState(0);
  const [dropIndex, setDropIndex] = useState<number | null>(null);

  const geomRef = useRef<DragGeom | null>(null);
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

  // Always clean up if the component unmounts mid-drag.
  useEffect(() => {
    return () => detachDocListeners();
  }, [detachDocListeners]);

  const endGesture = useCallback(() => {
    detachDocListeners();
    geomRef.current = null;
    setDraggingId(null);
    setTranslateY(0);
    setDropIndex(null);
  }, [detachDocListeners]);

  const computeDropIndex = useCallback((clientY: number): number => {
    const geom = geomRef.current;
    if (!geom) return -1;
    // Skip the source's own slot when picking a target — counting it
    // would let the drop "land where it already is" on no movement.
    const others = geom.rows.filter((r) => r.id !== geom.sourceId);
    let idx = others.length;
    for (let i = 0; i < others.length; i++) {
      const mid = others[i].top + others[i].height / 2;
      if (clientY < mid) {
        idx = i;
        break;
      }
    }
    // Translate back to the full-list index space. The drop indicator
    // line renders BEFORE the row at `idx` in the others array, which
    // maps to either that row's original index or one past it depending
    // on whether the source originally sat above it.
    if (idx >= others.length) return geom.rows.length - 1;
    const target = others[idx];
    return target.index > geom.sourceIndex ? target.index - 1 : target.index;
  }, []);

  const gripProps = useCallback(
    (id: string) => ({
      style: {
        touchAction: "none",
        WebkitTouchCallout: "none",
        WebkitUserSelect: "none",
        userSelect: "none",
      } as CSSProperties,
      onPointerDown(e: ReactPointerEvent<HTMLElement>) {
        if (e.pointerType === "mouse" && e.button !== 0) return;
        e.preventDefault();
        const grip = e.currentTarget;
        const li = grip.closest<HTMLElement>(`[data-${dataAttribute}]`);
        if (!li) return;
        const ul = li.parentElement;
        if (!ul) return;
        const liEls = Array.from(
          ul.querySelectorAll<HTMLElement>(
            `:scope > [data-${dataAttribute}]`,
          ),
        );
        const rows: RowGeom[] = liEls.map((el, idx) => {
          const r = el.getBoundingClientRect();
          return {
            id: el.dataset[toCamel(dataAttribute)] ?? "",
            top: r.top,
            height: r.height,
            index: idx,
          };
        });
        const sourceIndex = rows.findIndex((r) => r.id === id);
        if (sourceIndex < 0) return;
        geomRef.current = {
          sourceId: id,
          sourceIndex,
          sourceHeight: rows[sourceIndex].height,
          startY: e.clientY,
          pointerId: e.pointerId,
          rows,
        };
        setDraggingId(id);
        setDropIndex(sourceIndex);

        const onMove = (ev: PointerEvent) => {
          const g = geomRef.current;
          if (!g || ev.pointerId !== g.pointerId) return;
          ev.preventDefault();
          setTranslateY(ev.clientY - g.startY);
          setDropIndex(computeDropIndex(ev.clientY));
        };
        const onEnd = (ev: PointerEvent) => {
          const g = geomRef.current;
          if (!g || ev.pointerId !== g.pointerId) return;
          if (ev.type === "pointerup") {
            const target = computeDropIndex(ev.clientY);
            if (target >= 0 && target !== g.sourceIndex) {
              onReorder(g.sourceIndex, target);
            }
          }
          endGesture();
        };
        moveHandlerRef.current = onMove;
        endHandlerRef.current = onEnd;
        document.addEventListener("pointermove", onMove, { passive: false });
        document.addEventListener("pointerup", onEnd);
        document.addEventListener("pointercancel", onEnd);
      },
    }),
    [computeDropIndex, dataAttribute, endGesture, onReorder],
  );

  const rowStyle = useCallback(
    (id: string): CSSProperties | undefined => {
      if (draggingId === null) return undefined;
      if (id === draggingId) {
        return {
          transform: `translateY(${translateY}px)`,
          transition: "none",
          position: "relative",
          zIndex: 10,
          boxShadow: "0 14px 28px -8px rgba(0, 0, 0, 0.5)",
          cursor: "grabbing",
          touchAction: "none",
        };
      }
      return { transition: SHIFT_TRANSITION };
    },
    [draggingId, translateY],
  );

  return {
    gripProps,
    rowStyle,
    draggingId,
    dropIndex,
  };
}

// Convert "list-row" → "listRow" to read dataset["listRow"].
function toCamel(s: string): string {
  return s.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
}
