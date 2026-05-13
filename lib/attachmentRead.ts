// Helpers for the attachment-pick paths (camera / library / files)
// shared by TransactionForm receipts and AttachPhotoCard photos.
//
// Image picks already flow through lib/imageResize so they end up
// ~150KB regardless of input. PDFs aren't resized — they're stored
// raw as a base64 data URL, which means the cloud-synced state
// document grows by ~1.3× the file's byte size. Firestore caps a
// single document at 1MB, so we enforce a tight per-attachment
// limit here to keep the merged state from breaking sync.

const MAX_PDF_BYTES = 500_000;

export const PDF_SIZE_LIMIT_LABEL = "500 KB";

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
