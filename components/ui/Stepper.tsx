"use client";

import { Minus, Plus } from "lucide-react";
import { cn } from "./cn";

/*
 * Stepper — large −/+ number control for fast on-phone entry. Tap targets are
 * 44px so it's comfortable mid-workout. Used for logging actual weight & reps.
 */
export function Stepper({
  value,
  onChange,
  min = 0,
  max = 9999,
  step = 1,
  disabled,
  suffix,
  ariaLabel,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  suffix?: string;
  ariaLabel?: string;
}) {
  const clamp = (v: number) => Math.min(max, Math.max(min, v));
  // Avoid floating-point drift on fractional steps (e.g. 2.5 kg).
  const round = (v: number) => Math.round(v * 100) / 100;

  return (
    <div
      className={cn(
        "inline-flex items-center rounded-btn border border-border bg-surface",
        disabled && "opacity-50",
      )}
    >
      <button
        type="button"
        aria-label={ariaLabel ? `Decrease ${ariaLabel}` : "Decrease"}
        disabled={disabled || value <= min}
        onClick={() => onChange(clamp(round(value - step)))}
        className="flex h-11 w-11 items-center justify-center rounded-l-btn text-ink-secondary transition-colors hover:bg-surface-sunken active:bg-border disabled:cursor-not-allowed disabled:text-ink-disabled"
      >
        <Minus size={18} strokeWidth={2.5} />
      </button>
      <div className="min-w-[72px] select-none px-1 text-center text-[15px] font-semibold tabular-nums text-ink">
        {value}
        {suffix ? <span className="ml-0.5 text-[13px] font-medium text-ink-tertiary">{suffix}</span> : null}
      </div>
      <button
        type="button"
        aria-label={ariaLabel ? `Increase ${ariaLabel}` : "Increase"}
        disabled={disabled || value >= max}
        onClick={() => onChange(clamp(round(value + step)))}
        className="flex h-11 w-11 items-center justify-center rounded-r-btn text-ink-secondary transition-colors hover:bg-surface-sunken active:bg-border disabled:cursor-not-allowed disabled:text-ink-disabled"
      >
        <Plus size={18} strokeWidth={2.5} />
      </button>
    </div>
  );
}
