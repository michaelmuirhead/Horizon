"use client";

import { useRef, type ChangeEvent } from "react";
import { Camera, X } from "lucide-react";
import { resizeImageFile } from "@/lib/imageResize";

type Props = {
  // Current photo as a data URL, or undefined when none is attached.
  value: string | undefined;
  // Called with a fresh data URL on add/replace and null on remove.
  onChange: (next: string | null) => void;
  // What the attached photo represents — drives the section label
  // and the file-input id so multiple cards on the same page don't
  // collide. e.g. "Statement", "Loan agreement", "Goal photo".
  label: string;
  // Stable id segment that scopes the file <input> per consumer
  // when more than one card might render on the same page. Pass the
  // account id / goal id.
  scopeId: string;
};

// Shared "attach a photo" card used by liability accounts (loans /
// bills — the statement or contract) and by savings goals (the thing
// being saved for). Mirrors the receipt UX on TransactionForm:
// downscale client-side via resizeImageFile, store as a data URL,
// show inline with a remove button.
export default function AttachPhotoCard({
  value,
  onChange,
  label,
  scopeId,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  async function handlePicked(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await resizeImageFile(file);
      onChange(dataUrl);
    } catch {
      // Image too large or unreadable — leave the existing photo alone.
    }
    if (inputRef.current) inputRef.current.value = "";
  }

  const inputId = `photo-${scopeId}`;

  return (
    <section className="rounded-2xl bg-card p-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-medium uppercase tracking-wide text-fg/60">
          {label}
        </p>
        <div className="flex items-center gap-2">
          {value && (
            <button
              type="button"
              onClick={() => onChange(null)}
              aria-label={`Remove ${label.toLowerCase()}`}
              className="grid h-7 w-7 place-items-center rounded-full bg-card-elevated text-fg/70"
            >
              <X size={14} strokeWidth={2.4} />
            </button>
          )}
          <label
            htmlFor={inputId}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-card-elevated px-3 py-1.5 text-xs font-bold text-fg/85"
          >
            <Camera size={14} strokeWidth={2.4} />
            {value ? "Replace" : "Add photo"}
          </label>
          {/* `capture="environment"` cues iOS to default the camera
              roll picker to the rear camera. The user can still pick
              an existing image from their library. */}
          <input
            id={inputId}
            ref={inputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handlePicked}
            className="sr-only"
          />
        </div>
      </div>
      {value && (
        <div className="mt-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={value}
            alt={label}
            className="block max-h-72 w-full rounded-xl object-contain bg-card-elevated"
          />
        </div>
      )}
    </section>
  );
}
