"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

const MAX_FILES = 10;
const MAX_SIZE_BYTES = 10 * 1024 * 1024;
const ACCEPTED_EXT = [".jpg", ".jpeg", ".png", ".heic", ".heif"];

const PROGRESS_MESSAGES = [
  "Compressing and uploading photos...",
  "Looking around your gym...",
  "Checking for mirrors and reflections...",
  "Reading weights and stack numbers...",
  "Putting together your equipment list...",
];

type PickedPhoto = {
  file: File;
  previewUrl: string;
};

function isAcceptedFile(file: File): boolean {
  const name = file.name.toLowerCase();
  return ACCEPTED_EXT.some((ext) => name.endsWith(ext));
}

// Vercel serverless functions reject request bodies over ~4.5 MB, and phone
// photos are typically 3-8 MB each. Downscale to 1568px (Claude vision's max
// useful size) and re-encode as JPEG in the browser before uploading.
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

async function compressPhoto(file: File): Promise<File> {
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

export default function SetupPage() {
  const router = useRouter();
  const [photos, setPhotos] = useState<PickedPhoto[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [progressIndex, setProgressIndex] = useState(0);
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!loading) return;
    const id = setInterval(() => {
      setProgressIndex((i) => Math.min(i + 1, PROGRESS_MESSAGES.length - 1));
    }, 4000);
    return () => clearInterval(id);
  }, [loading]);

  useEffect(() => {
    return () => {
      photos.forEach((p) => URL.revokeObjectURL(p.previewUrl));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function addFiles(fileList: FileList | File[]) {
    setError(null);
    const incoming = Array.from(fileList);
    const accepted: PickedPhoto[] = [];
    for (const file of incoming) {
      if (!isAcceptedFile(file)) {
        setError(`Unsupported file: ${file.name}. Use JPEG, PNG, or HEIC.`);
        continue;
      }
      if (file.size > MAX_SIZE_BYTES) {
        setError(`${file.name} is larger than 10 MB.`);
        continue;
      }
      accepted.push({ file, previewUrl: URL.createObjectURL(file) });
    }
    setPhotos((prev) => {
      const combined = [...prev, ...accepted];
      if (combined.length > MAX_FILES) {
        setError(`You can upload up to ${MAX_FILES} photos. Extra photos were skipped.`);
        return combined.slice(0, MAX_FILES);
      }
      return combined;
    });
  }

  function removePhoto(index: number) {
    setPhotos((prev) => {
      const copy = [...prev];
      URL.revokeObjectURL(copy[index].previewUrl);
      copy.splice(index, 1);
      return copy;
    });
  }

  async function handleRecognize() {
    if (photos.length === 0) return;
    setLoading(true);
    setProgressIndex(0);
    setError(null);
    try {
      const compressed = await Promise.all(photos.map((p) => compressPhoto(p.file)));
      const formData = new FormData();
      for (const file of compressed) formData.append("photos", file);

      const res = await fetch("/api/recognize-equipment", {
        method: "POST",
        body: formData,
      });
      // Don't assume JSON: infra errors (413 body-too-large, timeouts) return
      // plain text/HTML, and res.json() then throws a cryptic Safari error.
      const text = await res.text();
      let data: { items?: unknown; photoUrls?: unknown; error?: string } | null = null;
      try {
        data = JSON.parse(text);
      } catch {
        data = null;
      }
      if (!res.ok) {
        throw new Error(
          data?.error ||
            `Upload failed (HTTP ${res.status}). Try again with fewer photos.`
        );
      }
      if (!data) {
        throw new Error("Unexpected server response. Please try again.");
      }
      sessionStorage.setItem(
        "gymsnap:recognized",
        JSON.stringify({ items: data.items, photoUrls: data.photoUrls })
      );
      router.push("/setup/confirm");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setLoading(false);
    }
  }

  return (
    <main className="p-4 flex flex-col gap-4">
      <header>
        <h1 className="text-xl font-bold">Photograph your gym</h1>
        <p className="text-sm text-gray-500 mt-1">
          Add up to 10 photos. One photo can cover several machines at once —
          wide shots of a whole corner or wall work great. GymSnap will identify
          the equipment for your weekly plan.
        </p>
      </header>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragActive(false);
          if (e.dataTransfer.files) addFiles(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        className={`rounded-xl border-2 border-dashed p-6 text-center cursor-pointer transition-colors ${
          dragActive ? "border-cyan-500 bg-cyan-50" : "border-gray-300 bg-white"
        }`}
      >
        <p className="text-3xl mb-2">📷</p>
        <p className="text-sm font-medium text-gray-700">
          Tap to choose photos, or drag and drop
        </p>
        <p className="text-xs text-gray-400 mt-1">JPEG, PNG, or HEIC · up to 10 MB each</p>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/heic,image/heif"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files) addFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm p-3">
          {error}
        </div>
      )}

      {photos.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {photos.map((p, i) => (
            <div key={p.previewUrl} className="relative aspect-square">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={p.previewUrl}
                alt={`Gym photo ${i + 1}`}
                className="h-full w-full object-cover rounded-lg"
              />
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  removePhoto(i);
                }}
                className="absolute -top-1.5 -right-1.5 h-6 w-6 rounded-full bg-black/70 text-white text-xs flex items-center justify-center"
                aria-label="Remove photo"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      <button
        type="button"
        disabled={photos.length === 0 || loading}
        onClick={handleRecognize}
        className="rounded-lg bg-gray-900 text-white py-3 font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {loading ? "Recognizing..." : "Recognize equipment"}
      </button>

      {loading && (
        <div className="rounded-lg bg-cyan-50 border border-cyan-200 text-cyan-800 text-sm p-3 flex items-center gap-2">
          <span className="inline-block h-4 w-4 rounded-full border-2 border-cyan-600 border-t-transparent animate-spin" />
          {PROGRESS_MESSAGES[progressIndex]}
        </div>
      )}
    </main>
  );
}
