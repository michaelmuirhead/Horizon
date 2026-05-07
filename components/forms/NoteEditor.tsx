"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Pencil, X } from "lucide-react";

export default function NoteEditor({
  value,
  onCommit,
  ariaLabel,
  placeholder = "Add a note",
}: {
  value: string;
  onCommit: (next: string) => void;
  ariaLabel: string;
  placeholder?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  function commit() {
    setEditing(false);
    if (draft !== value) onCommit(draft);
  }

  function cancel() {
    setDraft(value);
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
      <div className="mt-1 flex items-center gap-2">
        <input
          ref={inputRef}
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={handleKeyDown}
          aria-label={ariaLabel}
          placeholder={placeholder}
          className="flex-1 rounded-md bg-card-elevated px-2.5 py-1.5 text-xs outline-none placeholder:text-fg/40"
        />
        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            cancel();
          }}
          aria-label="Cancel note"
          className="grid h-6 w-6 place-items-center text-fg/55"
        >
          <X size={12} />
        </button>
      </div>
    );
  }

  if (value.trim() === "") {
    return (
      <button
        type="button"
        onClick={() => {
          setDraft(value);
          setEditing(true);
        }}
        aria-label={ariaLabel}
        className="mt-1 flex items-center gap-1 text-xs text-fg/40 hover:text-accent"
      >
        <Pencil size={11} />
        {placeholder}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => {
        setDraft(value);
        setEditing(true);
      }}
      aria-label={ariaLabel}
      className="mt-1 block w-full text-left text-xs text-fg/65 italic hover:text-accent"
    >
      {value}
    </button>
  );
}
