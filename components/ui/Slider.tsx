"use client";

import * as React from "react";
import { cn } from "./cn";

/*
 * Slider — custom-styled range (never the native control). Pointer-drag on a
 * 6px track with a teal fill and a 22px thumb. Keyboard-accessible via the
 * arrow keys. Controlled through value/onChange.
 */
export function Slider({
  value,
  min = 0,
  max = 100,
  step = 1,
  onChange,
  className,
  "aria-label": ariaLabel,
}: {
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (value: number) => void;
  className?: string;
  "aria-label"?: string;
}) {
  const trackRef = React.useRef<HTMLDivElement>(null);
  const pct = ((value - min) / (max - min)) * 100;

  const setFromClientX = React.useCallback(
    (clientX: number) => {
      const el = trackRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      let t = (clientX - r.left) / r.width;
      t = Math.max(0, Math.min(1, t));
      const raw = min + t * (max - min);
      const snapped = Math.round(raw / step) * step;
      onChange(Math.max(min, Math.min(max, snapped)));
    },
    [min, max, step, onChange],
  );

  function onPointerDown(e: React.PointerEvent) {
    e.preventDefault();
    setFromClientX(e.clientX);
    const move = (ev: PointerEvent) => setFromClientX(ev.clientX);
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
      e.preventDefault();
      onChange(Math.max(min, value - step));
    } else if (e.key === "ArrowRight" || e.key === "ArrowUp") {
      e.preventDefault();
      onChange(Math.min(max, value + step));
    }
  }

  return (
    <div
      role="slider"
      aria-label={ariaLabel}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={value}
      tabIndex={0}
      onPointerDown={onPointerDown}
      onKeyDown={onKeyDown}
      className={cn(
        "relative flex h-6 touch-none items-center outline-none",
        "focus-visible:[&>div]:ring-[3px] focus-visible:[&>div]:ring-accent-border/30",
        className,
      )}
    >
      <div
        ref={trackRef}
        className="relative h-1.5 w-full rounded-pill bg-border"
      >
        <div
          className="absolute left-0 top-0 h-full rounded-pill bg-accent"
          style={{ width: `${pct}%` }}
        />
        <div
          className="absolute top-1/2 h-[22px] w-[22px] -translate-x-1/2 -translate-y-1/2 cursor-grab rounded-full border-2 border-accent bg-white shadow-[0_1px_3px_rgba(0,0,0,0.2)] active:cursor-grabbing"
          style={{ left: `${pct}%` }}
        />
      </div>
    </div>
  );
}
