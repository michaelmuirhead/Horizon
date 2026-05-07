"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

type Props = {
  title: string;
  defaultExpanded?: boolean;
  // Optional badge / label on the right edge of the header — sits outside
  // the toggle button so tapping it doesn't collapse the card.
  headerRight?: ReactNode;
  children: ReactNode;
};

export default function CollapsibleCard({
  title,
  defaultExpanded = true,
  headerRight,
  children,
}: Props) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <section className="rounded-3xl bg-card p-5">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex flex-1 items-center gap-2 text-left"
          aria-expanded={expanded}
        >
          <ChevronDown
            size={18}
            strokeWidth={2.5}
            className={`transition-transform ${expanded ? "" : "-rotate-90"}`}
          />
          <h2 className="text-xl font-bold">{title}</h2>
        </button>
        {headerRight}
      </div>
      {expanded && <div className="mt-4 hz-fade-in">{children}</div>}
    </section>
  );
}
