"use client";

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";

// Shared pointer-events drag for the budget category management — used
// by the Manage Categories page and the inline edit mode on /budget.
// Lives apart from the HTML5 drag API because iOS Safari and the
// WKWebView-backed PWA don't fire `dragstart` on touch.
//
// Consumers add `data-mc-group="<id>"` to each group's outer
// container and `data-mc-category="<id>"` to each category row. The
// hook captures the source on pointerdown and resolves the drop
// target on every move via `document.elementsFromPoint`, which lets
// drops cross between groups without per-group geometry tracking.

export type DragKind = "group" | "category";

type DragState = {
  kind: DragKind;
  sourceId: string;
  pointerId: number;
  startY: number;
  // Hover targets recomputed on every move via elementsFromPoint.
  // Either may be null when the pointer is over empty space.
  hoverGroupId: string | null;
  hoverCategoryId: string | null;
};

// Inline styles applied to every grip handle. iOS Safari needs the
// -webkit- prefixed callout / user-select rules to suppress the
// long-press magnifier and text-selection callout, both of which
// otherwise abort the gesture mid-drag with a pointercancel.
export const GRIP_STYLE: CSSProperties = {
  touchAction: "none",
  WebkitTouchCallout: "none",
  WebkitUserSelect: "none",
  userSelect: "none",
};

type Group = { id: string; categories: { id: string }[] };

type Options = {
  // Reads the current groups + categories layout. We accept a getter
  // (not a value) so the hook can stay subscription-free; the closure
  // captured at pointerdown reads the latest value when the drop
  // commits, not a snapshot from when the hook was last rendered.
  groups: Group[];
  reorderGroup: (groupId: string, targetIndex: number) => void;
  reorderCategory: (
    categoryId: string,
    targetIndex: number,
    destGroupId?: string,
  ) => void;
};

export function useCategoryReorderDrag({
  groups,
  reorderGroup,
  reorderCategory,
}: Options) {
  const [drag, setDrag] = useState<DragState | null>(null);
  const [translateY, setTranslateY] = useState(0);
  const moveHandlerRef = useRef<((e: PointerEvent) => void) | null>(null);
  const endHandlerRef = useRef<((e: PointerEvent) => void) | null>(null);
  // Always read the latest groups via this ref — drag close-overs
  // would otherwise capture a stale snapshot from pointerdown time.
  const groupsRef = useRef(groups);
  groupsRef.current = groups;

  useEffect(() => {
    return () => {
      if (moveHandlerRef.current) {
        document.removeEventListener("pointermove", moveHandlerRef.current);
        moveHandlerRef.current = null;
      }
      if (endHandlerRef.current) {
        document.removeEventListener("pointerup", endHandlerRef.current);
        document.removeEventListener("pointercancel", endHandlerRef.current);
        endHandlerRef.current = null;
      }
    };
  }, []);

  function endGesture() {
    if (moveHandlerRef.current) {
      document.removeEventListener("pointermove", moveHandlerRef.current);
      moveHandlerRef.current = null;
    }
    if (endHandlerRef.current) {
      document.removeEventListener("pointerup", endHandlerRef.current);
      document.removeEventListener("pointercancel", endHandlerRef.current);
      endHandlerRef.current = null;
    }
    setDrag(null);
    setTranslateY(0);
  }

  function commitDrop(state: DragState) {
    const liveGroups = groupsRef.current;
    if (state.kind === "group") {
      const targetGroupId = state.hoverGroupId;
      if (!targetGroupId || targetGroupId === state.sourceId) return;
      const idx = liveGroups.findIndex((g) => g.id === targetGroupId);
      if (idx >= 0) reorderGroup(state.sourceId, idx);
      return;
    }
    if (
      state.hoverCategoryId &&
      state.hoverCategoryId !== state.sourceId
    ) {
      const ownerGroup = liveGroups.find((g) =>
        g.categories.some((c) => c.id === state.sourceId),
      );
      const destGroup = liveGroups.find((g) =>
        g.categories.some((c) => c.id === state.hoverCategoryId),
      );
      if (!ownerGroup || !destGroup) return;
      const targetIndex = destGroup.categories.findIndex(
        (c) => c.id === state.hoverCategoryId,
      );
      if (targetIndex < 0) return;
      if (ownerGroup.id === destGroup.id) {
        reorderCategory(state.sourceId, targetIndex);
      } else {
        reorderCategory(state.sourceId, targetIndex, destGroup.id);
      }
      return;
    }
    if (state.hoverGroupId) {
      const ownerGroup = liveGroups.find((g) =>
        g.categories.some((c) => c.id === state.sourceId),
      );
      const destGroup = liveGroups.find((g) => g.id === state.hoverGroupId);
      if (!ownerGroup || !destGroup) return;
      if (ownerGroup.id === destGroup.id) return;
      reorderCategory(
        state.sourceId,
        destGroup.categories.length,
        destGroup.id,
      );
    }
  }

  function gripPointerDown(kind: DragKind, sourceId: string) {
    return (e: ReactPointerEvent<HTMLElement>) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      e.preventDefault();
      const initial: DragState = {
        kind,
        sourceId,
        pointerId: e.pointerId,
        startY: e.clientY,
        hoverGroupId: null,
        hoverCategoryId: null,
      };
      setDrag(initial);
      setTranslateY(0);
      // Mutable closure copy so move/end can read the latest hover
      // state without round-tripping through React.
      let live: DragState = initial;

      const onMove = (ev: PointerEvent) => {
        if (ev.pointerId !== e.pointerId) return;
        ev.preventDefault();
        setTranslateY(ev.clientY - e.clientY);
        const stack = document.elementsFromPoint(ev.clientX, ev.clientY);
        let hoverCategoryId: string | null = null;
        let hoverGroupId: string | null = null;
        for (const el of stack) {
          if (!(el instanceof HTMLElement)) continue;
          const cat = el.closest<HTMLElement>("[data-mc-category]");
          if (cat && cat.dataset.mcCategory !== sourceId) {
            hoverCategoryId = cat.dataset.mcCategory ?? null;
            hoverGroupId =
              cat
                .closest<HTMLElement>("[data-mc-group]")
                ?.dataset.mcGroup ?? null;
            break;
          }
          const grp = el.closest<HTMLElement>("[data-mc-group]");
          if (
            grp &&
            grp.dataset.mcGroup !== (kind === "group" ? sourceId : "")
          ) {
            hoverGroupId = grp.dataset.mcGroup ?? null;
          }
        }
        live = { ...live, hoverGroupId, hoverCategoryId };
        setDrag(live);
      };

      const onEnd = (ev: PointerEvent) => {
        if (ev.pointerId !== e.pointerId) return;
        if (ev.type === "pointerup") commitDrop(live);
        endGesture();
      };

      moveHandlerRef.current = onMove;
      endHandlerRef.current = onEnd;
      document.addEventListener("pointermove", onMove, { passive: false });
      document.addEventListener("pointerup", onEnd);
      document.addEventListener("pointercancel", onEnd);
    };
  }

  function rowStyle(kind: DragKind, id: string): CSSProperties | undefined {
    if (drag === null) return undefined;
    if (drag.kind === kind && drag.sourceId === id) {
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
    return undefined;
  }

  return {
    drag,
    gripPointerDown,
    rowStyle,
  };
}
