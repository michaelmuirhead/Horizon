"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { MoreVertical } from "lucide-react";

export type RowMenuItem = {
  label: string;
  // Returns false to keep the menu open after acting (e.g. inline edit
  // mode); otherwise the menu closes after the click.
  onClick: () => boolean | void;
  // Renders the row in rose tones — used for destructive actions like
  // Delete. Confirmation is the caller's responsibility.
  destructive?: boolean;
  icon?: ReactNode;
};

type Props = {
  items: RowMenuItem[];
  // Tooltip / aria label so the kebab is reachable for the right row.
  ariaLabel: string;
};

// Tiny popover menu anchored under a kebab button. Closes on outside
// click, Escape, or after an item fires (unless the item explicitly
// returns false to keep it open).
export default function RowMenu({ items, ariaLabel }: Props) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      const wrap = wrapperRef.current;
      if (!wrap) return;
      if (!wrap.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={wrapperRef} className="relative shrink-0">
      <button
        type="button"
        aria-label={ariaLabel}
        aria-expanded={open}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className="grid h-9 w-9 place-items-center rounded-full text-fg/55 hover:bg-card-elevated hover:text-fg"
      >
        <MoreVertical size={18} strokeWidth={2.4} />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-20 mt-1 min-w-[10rem] overflow-hidden rounded-2xl bg-card-elevated shadow-2xl ring-1 ring-fg/10"
        >
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                const keepOpen = item.onClick();
                if (keepOpen !== false) setOpen(false);
              }}
              className={`flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm font-semibold ${
                item.destructive
                  ? "text-rose-400 hover:bg-rose-500/10"
                  : "text-fg hover:bg-fg/5"
              }`}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
