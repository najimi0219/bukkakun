/**
 * Client-side image compression.
 *
 * Inquirer-uploaded business cards from phone cameras average 2–4 MB.
 * We re-encode them to JPEG with quality 0.8 and a max long-edge of
 * 1600px before uploading — typically yielding 200–400 KB per image,
 * an ~8–10× storage saving with no visible quality loss for a business
 * card.
 *
 * Best-effort: if the browser can't decode the input (e.g. HEIC on
 * non-iOS browsers) we fall back to uploading the original file.
 */

export interface CompressOptions {
  /** Max width or height after resize. Default 1600. */
  maxDim?: number;
  /** JPEG quality 0–1. Default 0.8. */
  quality?: number;
  /** Skip compression for files already smaller than this (bytes). Default 200 KB. */
  skipIfUnderBytes?: number;
}

export async function compressImage(
  file: File,
  opts: CompressOptions = {}
): Promise<File> {
  const maxDim = opts.maxDim ?? 1600;
  const quality = opts.quality ?? 0.8;
  const skipIfUnder = opts.skipIfUnderBytes ?? 200 * 1024;

  if (typeof document === "undefined") return file;

  // Quick exit: already small JPEG, no work to do.
  if (file.type === "image/jpeg" && file.size <= skipIfUnder) return file;

  // Try to decode the image. HEIC etc. may throw / return broken dimensions.
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    if (!img.width || !img.height) return file;

    const { width, height } = scaleDown(img.width, img.height, maxDim);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.fillStyle = "#ffffff"; // transparent PNG should not become black JPEG
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);

    const blob: Blob | null = await new Promise((resolve) =>
      canvas.toBlob((b) => resolve(b), "image/jpeg", quality)
    );
    if (!blob) return file;

    // If somehow re-encode came out larger than the input, keep the input.
    if (blob.size >= file.size) return file;

    const newName = file.name.replace(/\.[^.]+$/, "") + ".jpg";
    return new File([blob], newName, {
      type: "image/jpeg",
      lastModified: Date.now(),
    });
  } catch {
    return file;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("image load failed"));
    img.src = src;
  });
}

function scaleDown(
  w: number,
  h: number,
  maxDim: number
): { width: number; height: number } {
  if (w <= maxDim && h <= maxDim) return { width: w, height: h };
  const ratio = w >= h ? maxDim / w : maxDim / h;
  return {
    width: Math.round(w * ratio),
    height: Math.round(h * ratio),
  };
}
