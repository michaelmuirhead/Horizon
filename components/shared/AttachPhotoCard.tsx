"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { Camera, FolderOpen, ImageIcon, X } from "lucide-react";
import { resizeImageFile } from "@/lib/imageResize";
import {
  PDF_SIZE_LIMIT_LABEL,
  isPdfDataUrl,
  isPdfTooLargeError,
  readPdfAsDataUrl,
} from "@/lib/attachmentRead";

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
//
// Three pick paths:
//   • Camera   — capture="environment", iOS opens the rear camera.
//   • Library  — accept="image/*", iOS opens the photo picker.
//   • Files    — no accept attribute, iOS skips the photo action
//                sheet and opens the Files app directly (iCloud
//                Drive, On My iPhone, third-party providers).
//
// Browsers don't let one <input> toggle capture / accept
// dynamically — each path needs its own element. The Files input
// can yield a non-image (PDF, doc); resizeImageFile rejects that
// and the existing catch leaves the current photo untouched.
export default function AttachPhotoCard({
  value,
  onChange,
  label,
  scopeId,
}: Props) {
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const libraryInputRef = useRef<HTMLInputElement>(null);
  const filesInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  // Auto-clear the error pill after a beat so a stale "too large"
  // message doesn't linger after the user picks a valid file.
  useEffect(() => {
    if (!error) return;
    const t = window.setTimeout(() => setError(null), 4000);
    return () => window.clearTimeout(t);
  }, [error]);

  function handlePickedFrom(ref: React.RefObject<HTMLInputElement | null>) {
    return async (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setError(null);
      try {
        if (file.type === "application/pdf") {
          const dataUrl = await readPdfAsDataUrl(file);
          onChange(dataUrl);
        } else {
          const dataUrl = await resizeImageFile(file);
          onChange(dataUrl);
        }
      } catch (err) {
        if (isPdfTooLargeError(err)) {
          setError(`PDF is too large — keep it under ${PDF_SIZE_LIMIT_LABEL}.`);
        }
        // Other errors (non-image picked via Files, corrupt file)
        // silently leave the existing photo alone.
      }
      if (ref.current) ref.current.value = "";
    };
  }

  const cameraInputId = `photo-${scopeId}-camera`;
  const libraryInputId = `photo-${scopeId}-library`;
  const filesInputId = `photo-${scopeId}-files`;

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
            htmlFor={cameraInputId}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-card-elevated px-3 py-1.5 text-xs font-bold text-fg/85"
          >
            <Camera size={14} strokeWidth={2.4} />
            Camera
          </label>
          <input
            id={cameraInputId}
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handlePickedFrom(cameraInputRef)}
            className="sr-only"
          />
          <label
            htmlFor={libraryInputId}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-card-elevated px-3 py-1.5 text-xs font-bold text-fg/85"
          >
            <ImageIcon size={14} strokeWidth={2.4} />
            Library
          </label>
          <input
            id={libraryInputId}
            ref={libraryInputRef}
            type="file"
            accept="image/*"
            onChange={handlePickedFrom(libraryInputRef)}
            className="sr-only"
          />
          <label
            htmlFor={filesInputId}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-card-elevated px-3 py-1.5 text-xs font-bold text-fg/85"
          >
            <FolderOpen size={14} strokeWidth={2.4} />
            Files
          </label>
          <input
            id={filesInputId}
            ref={filesInputRef}
            type="file"
            onChange={handlePickedFrom(filesInputRef)}
            className="sr-only"
          />
        </div>
      </div>
      {error && (
        <p className="mt-2 text-xs font-semibold text-rose-300">{error}</p>
      )}
      {value && (
        <div className="mt-3">
          {isPdfDataUrl(value) ? (
            <div className="overflow-hidden rounded-xl bg-card-elevated">
              <iframe
                src={value}
                title={label}
                className="block h-72 w-full"
              />
              <a
                href={value}
                target="_blank"
                rel="noopener noreferrer"
                className="block px-3 py-2 text-center text-xs font-bold text-accent"
              >
                Open PDF in new tab
              </a>
            </div>
          ) : (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={value}
              alt={label}
              className="block max-h-72 w-full rounded-xl object-contain bg-card-elevated"
            />
          )}
        </div>
      )}
    </section>
  );
}
