"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import {
  Camera,
  FolderOpen,
  ImageIcon,
  Loader2,
  X,
} from "lucide-react";
import { useAuth } from "@/components/auth/AuthContext";
import { resizeImageFile } from "@/lib/imageResize";
import {
  PDF_SIZE_LIMIT_LABEL,
  isPdfDataUrl,
  isPdfTooLargeError,
  readPdfAsDataUrl,
} from "@/lib/attachmentRead";
import {
  deleteAttachment,
  isStorageUrl,
  uploadAttachment,
} from "@/lib/cloudStorage";

type Props = {
  // Current attachment value: either an https Firebase Storage URL,
  // an inline data URL, or undefined when none is attached.
  value: string | undefined;
  // The Storage object path for the current value. Present only when
  // the attachment lives in Storage — undefined for legacy inline
  // data URLs. The card uses it to clean up on replace / remove.
  storagePath?: string;
  // Called with a fresh value + path on add/replace and (null, null)
  // on remove. storagePath is null when we fall back to inline.
  onChange: (next: string | null, storagePath: string | null) => void;
  // What the attached file represents — drives the section label
  // and the file-input id so multiple cards on the same page don't
  // collide. e.g. "Statement", "Loan agreement", "Goal photo".
  label: string;
  // Stable id segment that scopes the file <input> per consumer
  // when more than one card might render on the same page.
  scopeId: string;
};

// Shared attach-a-file card. Routes uploads through Firebase Storage
// when the user is signed in + cloud sync is configured, so PDFs and
// images don't bloat the Firestore budget doc (1MB limit per doc).
// Falls back to inline data URLs for the local-only / signed-out
// path. Existing inline values keep rendering unchanged.
export default function AttachPhotoCard({
  value,
  storagePath,
  onChange,
  label,
  scopeId,
}: Props) {
  const { user } = useAuth();
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const libraryInputRef = useRef<HTMLInputElement>(null);
  const filesInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!error) return;
    const t = window.setTimeout(() => setError(null), 4000);
    return () => window.clearTimeout(t);
  }, [error]);

  // Best-effort cleanup of the previous Storage object. Fire-and-forget
  // — a delete failure just leaves an orphan, never blocks the user.
  function cleanupPrev() {
    if (storagePath) void deleteAttachment(storagePath);
  }

  async function commitFromFile(file: File) {
    setError(null);
    setUploading(true);
    try {
      // Determine the blob we'll store. PDFs go through readPdfAsDataUrl
      // mainly for the size check; we'll re-derive a Blob from the data
      // URL if we end up taking the inline path. Images flow through
      // resizeImageFile to a JPEG data URL.
      const isPdf = file.type === "application/pdf";
      const processedDataUrl = isPdf
        ? await readPdfAsDataUrl(file)
        : await resizeImageFile(file);

      // Cloud Storage path when signed in + configured. The upload
      // helper rejects with "storage-not-configured" when Firebase
      // isn't wired up; we catch and fall through to inline storage.
      if (user) {
        try {
          const blob = await dataUrlToBlob(processedDataUrl);
          const stored = await uploadAttachment(user.uid, blob, scopeId);
          cleanupPrev();
          onChange(stored.url, stored.path);
          return;
        } catch {
          // Fall through to inline below.
        }
      }
      cleanupPrev();
      onChange(processedDataUrl, null);
    } catch (err) {
      if (isPdfTooLargeError(err)) {
        setError(`PDF is too large — keep it under ${PDF_SIZE_LIMIT_LABEL}.`);
      }
      // Other errors (non-image / unreadable) silently leave the
      // existing attachment alone.
    } finally {
      setUploading(false);
    }
  }

  function handlePickedFrom(ref: React.RefObject<HTMLInputElement | null>) {
    return async (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (ref.current) ref.current.value = "";
      if (!file) return;
      await commitFromFile(file);
    };
  }

  function handleRemove() {
    cleanupPrev();
    onChange(null, null);
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
          {uploading && (
            <Loader2 size={14} className="animate-spin text-fg/55" />
          )}
          {value && !uploading && (
            <button
              type="button"
              onClick={handleRemove}
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
          {isPdfDataUrl(value) || value.toLowerCase().endsWith(".pdf") ? (
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
              loading={isStorageUrl(value) ? "lazy" : undefined}
              className="block max-h-72 w-full rounded-xl object-contain bg-card-elevated"
            />
          )}
        </div>
      )}
    </section>
  );
}

// Convert a data URL back into a Blob we can hand to uploadBytes.
// Faster than re-fetching the data URL via fetch() for the typical
// sizes we deal with here (a few hundred KB).
async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const res = await fetch(dataUrl);
  return res.blob();
}
