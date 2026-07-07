"use client";

const EXERCISE_IMAGE_BASE =
  "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/";

export function exerciseImageUrl(image: string): string {
  return `${EXERCISE_IMAGE_BASE}${image}`;
}

export default function ImageLightbox({
  images,
  title,
  onClose,
}: {
  images: string[];
  title: string;
  onClose: () => void;
}) {
  if (images.length === 0) return null;
  return (
    <div
      className="no-print fixed inset-0 z-50 bg-black/80 flex flex-col items-center justify-center p-4"
      onClick={onClose}
    >
      <div className="flex flex-col sm:flex-row gap-2 items-center justify-center w-full max-w-5xl">
        {images.map((img) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={img}
            src={exerciseImageUrl(img)}
            alt={title}
            className="rounded-lg object-contain min-w-0 max-h-[38vh] sm:max-h-[70vh] max-w-[90vw] sm:max-w-[calc(50%-0.25rem)]"
          />
        ))}
      </div>
      <p className="text-white text-sm mt-3">{title}</p>
      <button
        type="button"
        onClick={onClose}
        className="mt-4 rounded-full bg-white/20 text-white px-4 py-1.5 text-sm"
      >
        Close
      </button>
    </div>
  );
}
