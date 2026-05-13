// Firebase Storage helpers for attachments (receipts, account photos,
// goal photos, loan/bill statements). Attachments live in Storage so
// the Firestore budget document stays small (under the 1MB per-doc
// limit) regardless of how many or how large the attachments are.
//
// Path scheme:
//   users/{uid}/attachments/{ownerId}-{stamp}-{nonce}.{ext}
//
// The path is per-user — a household member uploads under their own
// uid and persists the resulting download URL in the shared state
// doc. Other household members fetch via the token-bearing URL.
// (Migrating to per-household paths would tighten access control;
// deferred until we actually have a sharing-related issue.)
//
// Returned URLs include a download token. They're effectively
// public-with-a-secret — fine for personal-finance attachments
// referenced from authed clients; not for sensitive customer data.
//
// ─── Required Firebase Storage rules ────────────────────────────
//
// Paste these into the Firebase console → Storage → Rules. The
// `users/{uid}/...` prefix matches the upload path below.
//
//   rules_version = '2';
//   service firebase.storage {
//     match /b/{bucket}/o {
//       match /users/{uid}/attachments/{file=**} {
//         allow read: if request.auth != null
//           && request.auth.uid == uid;
//         allow write: if request.auth != null
//           && request.auth.uid == uid
//           && request.resource.size < 15 * 1024 * 1024
//           && request.resource.contentType.matches(
//                "image/.*|application/pdf"
//              );
//       }
//     }
//   }
//
// 15MB write cap leaves slack over the client-side 10MB limit in
// lib/attachmentRead.ts. Tighten if you want stricter server-side
// enforcement.
//
// ─── Known limitation ───────────────────────────────────────────
//
// Removing an attachment via the UI fire-and-forgets a delete; we
// don't fire one when a Transaction / Account / SavingsGoal is
// deleted, so deleted entities leave their Storage objects as
// orphans. Cleanup is deferred to a future maintenance task —
// Storage holds ~5GB free, so the slow leak isn't urgent.

import { getFirebase } from "./firebase";

export type StoredAttachment = {
  // Download URL the UI uses as <img src> / <iframe src>.
  url: string;
  // Storage path for later deletion. Stored alongside `url` in state
  // so we can clean up when the user removes or replaces the file.
  path: string;
};

function nonce(): string {
  return Math.random().toString(36).slice(2, 10);
}

// Pulls an extension out of a MIME type. Falls back to "bin" so a
// stray upload still lands somewhere instead of throwing.
function extFor(mime: string): string {
  if (mime === "application/pdf") return "pdf";
  if (mime === "image/jpeg") return "jpg";
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  if (mime === "image/heic" || mime === "image/heif") return "heic";
  if (mime.startsWith("image/")) return mime.slice("image/".length);
  return "bin";
}

export async function uploadAttachment(
  uid: string,
  // Either a freshly picked File or the Blob we get back from
  // resizeImageFile's JPEG re-encode.
  blob: Blob,
  // Stable id the caller wants in the path (account id, transaction
  // id, goal id). Just for human readability — we add a timestamp
  // and a nonce so deletes and re-uploads don't collide.
  ownerId: string,
): Promise<StoredAttachment> {
  const handles = await getFirebase();
  if (!handles) throw new Error("storage-not-configured");
  const { ref, uploadBytes, getDownloadURL } = await import(
    "firebase/storage"
  );
  const ext = extFor(blob.type || "application/octet-stream");
  const path = `users/${uid}/attachments/${ownerId}-${Date.now()}-${nonce()}.${ext}`;
  const handle = ref(handles.storage, path);
  await uploadBytes(handle, blob, {
    contentType: blob.type || undefined,
  });
  const url = await getDownloadURL(handle);
  return { url, path };
}

// Best-effort delete. Network errors (e.g. file already gone) are
// swallowed since the worst case is one orphaned object in Storage;
// blocking the user on cleanup would be the wrong tradeoff.
export async function deleteAttachment(path: string): Promise<void> {
  if (!path) return;
  const handles = await getFirebase();
  if (!handles) return;
  try {
    const { ref, deleteObject } = await import("firebase/storage");
    await deleteObject(ref(handles.storage, path));
  } catch {
    // ignore — see comment above
  }
}

// True for an https URL — i.e. an attachment fetched from Storage —
// as opposed to a legacy inline data URL. The renderer uses the same
// <img> / <iframe> tags either way; this just lets callers know
// whether the resource lives on the network (lazy-loaded) or inline.
export function isStorageUrl(value: string | undefined): boolean {
  return typeof value === "string" && value.startsWith("https://");
}
