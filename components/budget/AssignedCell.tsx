"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { formatCurrency } from "@/lib/format";

export default function AssignedCell({
  value,
  onCommit,
  ariaLabel,
}: {
  value: number;
  onCommit: (next: number) => void;
  ariaLabel: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<string>("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  function startEditing() {
    setDraft(value === 0 ? "" : value.toFixed(2));
    setEditing(true);
  }

  function commit() {
    const trimmed = draft.trim();
    if (trimmed === "") {
      setEditing(false);
      if (value !== 0) onCommit(0);
      return;
    }
    const parsed = Number.parseFloat(trimmed);
    if (Number.isFinite(parsed) && parsed >= 0) {
      const rounded = Math.round(parsed * 100) / 100;
      if (rounded !== value) onCommit(rounded);
    }
    setEditing(false);
  }

  function cancel() {
    setEditing(false);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      commit();
    } else if (e.key === "Escape") {
      e.preventDefault();
      cancel();
    }
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="number"
        inputMode="decimal"
        step="0.01"
        min="0"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={handleKeyDown}
        aria-label={ariaLabel}
        className="w-24 bg-transparent text-right text-base font-bold tabular-nums outline-none ring-1 ring-accent rounded px-1 py-0.5"
      />
    );
  }

  return (
    <button
      type="button"
      onClick={startEditing}
      aria-label={ariaLabel}
      className="w-24 text-right text-base font-bold tabular-nums hover:text-accent focus:outline-none focus:text-accent"
    >
      {formatCurrency(value)}
    </button>
  );
}
