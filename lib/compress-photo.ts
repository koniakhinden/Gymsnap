// Client-side photo compression shared by the gym-setup and quick-workout
// photo uploaders. Vercel serverless functions reject request bodies over
// ~4.5 MB, and phone photos are typically 3-8 MB each. Downscale to 1568px
// (Claude vision's max useful size) and re-encode as JPEG before uploading.
const MAX_DIMENSION = 1568;
const JPEG_QUALITY = 0.8;

function canvasToJpegFile(canvas: HTMLCanvasElement, originalName: string): Promise<File> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) return reject(new Error("toBlob failed"));
        const name = originalName.replace(/\.\w+$/, "") + ".jpg";
        resolve(new File([blob], name, { type: "image/jpeg" }));
      },
      "image/jpeg",
      JPEG_QUALITY
    );
  });
}

export async function compressPhoto(file: File): Promise<File> {
  // Primary path: createImageBitmap (fast, respects EXIF orientation).
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("no canvas context");
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close();
    return await canvasToJpegFile(canvas, file.name);
  } catch {
    // Fallback path: <img> decode (covers browsers where createImageBitmap
    // can't decode this format, e.g. some HEIC cases).
    try {
      const url = URL.createObjectURL(file);
      try {
        const img = new Image();
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = () => reject(new Error("decode failed"));
          img.src = url;
        });
        const scale = Math.min(1, MAX_DIMENSION / Math.max(img.naturalWidth, img.naturalHeight));
        const w = Math.max(1, Math.round(img.naturalWidth * scale));
        const h = Math.max(1, Math.round(img.naturalHeight * scale));
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("no canvas context");
        ctx.drawImage(img, 0, 0, w, h);
        return await canvasToJpegFile(canvas, file.name);
      } finally {
        URL.revokeObjectURL(url);
      }
    } catch {
      // Give up compressing — send the original and let the server handle it.
      return file;
    }
  }
}
