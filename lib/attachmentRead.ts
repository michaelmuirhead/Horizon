// Helpers for the attachment-pick paths (camera / library / files)
// shared by TransactionForm receipts and AttachPhotoCard photos.
//
// Image picks flow through lib/imageResize so they land at ~150KB
// regardless of input. PDFs aren't resized — they're stored as
// raw bytes. Once the AttachPhotoCard / receipt-form upload path
// is reached they go to Firebase Storage (when the user is signed
// in), so the size limit here exists for two reasons:
//
//   1. The local-only fallback writes the file into the
//      Firestore-synced state as a data URL; very large PDFs
//      would blow out the 1MB-per-doc limit and break sync.
//   2. Even on the Storage path, localStorage is still the source
//      of truth pre-sync; capping keeps the persisted blob within
//      browsers' 5–10MB quota.
//
// 10MB is generous for typical receipt / statement PDFs and well
// under Storage's per-file limit.

const MAX_PDF_BYTES = 10 * 1024 * 1024;

export const PDF_SIZE_LIMIT_LABEL = "10 MB";

export async function readPdfAsDataUrl(file: File): Promise<string> {
  if (file.size > MAX_PDF_BYTES) {
    throw new Error(`pdf-too-large:${file.size}`);
  }
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error("pdf-read-failed"));
    reader.readAsDataURL(file);
  });
}

export function isPdfDataUrl(value: string | undefined): boolean {
  return typeof value === "string" && value.startsWith("data:application/pdf");
}

// True for the "too large" error thrown above. Lets call sites show a
// specific size message vs the generic "couldn't read" path.
export function isPdfTooLargeError(err: unknown): boolean {
  return err instanceof Error && err.message.startsWith("pdf-too-large:");
}
