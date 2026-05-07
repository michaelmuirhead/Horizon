// Browser-side image resize before persisting receipts. Caps the longer
// edge at MAX_PX and re-encodes as JPEG so a 5MB phone-camera shot lands
// in localStorage at ~150KB.

const MAX_PX = 1280;
const JPEG_QUALITY = 0.82;

export async function resizeImageFile(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, MAX_PX / Math.max(bitmap.width, bitmap.height));
    const w = Math.round(bitmap.width * scale);
    const h = Math.round(bitmap.height * scale);
    const canvas =
      typeof OffscreenCanvas !== "undefined"
        ? new OffscreenCanvas(w, h)
        : Object.assign(document.createElement("canvas"), { width: w, height: h });
    const ctx = (canvas as HTMLCanvasElement).getContext("2d");
    if (!ctx) throw new Error("2d context unavailable");
    ctx.drawImage(bitmap, 0, 0, w, h);
    if (canvas instanceof HTMLCanvasElement) {
      return canvas.toDataURL("image/jpeg", JPEG_QUALITY);
    }
    const blob = await (canvas as OffscreenCanvas).convertToBlob({
      type: "image/jpeg",
      quality: JPEG_QUALITY,
    });
    return await blobToDataUrl(blob);
  } finally {
    bitmap.close?.();
  }
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}
