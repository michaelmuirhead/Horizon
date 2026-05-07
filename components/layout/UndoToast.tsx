"use client";

import { Undo2, X } from "lucide-react";
import { useHorizonStore } from "@/components/store/HorizonStore";

export default function UndoToast() {
  const { pendingUndo, applyUndo, dismissUndo } = useHorizonStore();
  if (!pendingUndo) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-40 pb-[calc(env(safe-area-inset-bottom)+92px)] md:pb-6 md:pl-20"
    >
      <div className="mx-auto max-w-md md:max-w-3xl lg:max-w-5xl px-4">
        <div className="pointer-events-auto flex items-center gap-3 rounded-full bg-card-elevated/95 px-4 py-2.5 shadow-2xl ring-1 ring-fg/10">
          <span className="flex-1 text-sm text-fg/85 truncate">
            {pendingUndo.label}
          </span>
          <button
            type="button"
            onClick={applyUndo}
            className="inline-flex items-center gap-1.5 text-sm font-bold text-accent"
          >
            <Undo2 size={14} strokeWidth={2.5} />
            Undo
          </button>
          <button
            type="button"
            onClick={dismissUndo}
            aria-label="Dismiss"
            className="grid h-6 w-6 place-items-center text-fg/55"
          >
            <X size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
