"use client";

import { Minus, Plus } from "lucide-react";
import { cn } from "./cn";

/*
 * Stepper — −/+ number control for fast on-phone entry. Default tap targets are
 * 44px; `compact` shrinks to 40px so two steppers fit on one row when logging.
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
  compact,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  suffix?: string;
  ariaLabel?: string;
  compact?: boolean;
}) {
  const clamp = (v: number) => Math.min(max, Math.max(min, v));
  // Avoid floating-point drift on fractional steps (e.g. 2.5 kg).
  const round = (v: number) => Math.round(v * 100) / 100;

  const btn = compact ? "h-10 w-9" : "h-11 w-11";
  const valueBox = compact ? "min-w-[40px] text-[14px]" : "min-w-[72px] text-[15px]";

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
        className={cn(
          "flex items-center justify-center rounded-l-btn text-ink-secondary transition-colors hover:bg-surface-sunken active:bg-border disabled:cursor-not-allowed disabled:text-ink-disabled",
          btn,
        )}
      >
        <Minus size={compact ? 16 : 18} strokeWidth={2.5} />
      </button>
      <div
        className={cn(
          "select-none px-1 text-center font-semibold tabular-nums text-ink",
          valueBox,
        )}
      >
        {value}
        {suffix ? (
          <span className="ml-0.5 text-[12px] font-medium text-ink-tertiary">{suffix}</span>
        ) : null}
      </div>
      <button
        type="button"
        aria-label={ariaLabel ? `Increase ${ariaLabel}` : "Increase"}
        disabled={disabled || value >= max}
        onClick={() => onChange(clamp(round(value + step)))}
        className={cn(
          "flex items-center justify-center rounded-r-btn text-ink-secondary transition-colors hover:bg-surface-sunken active:bg-border disabled:cursor-not-allowed disabled:text-ink-disabled",
          btn,
        )}
      >
        <Plus size={compact ? 16 : 18} strokeWidth={2.5} />
      </button>
    </div>
  );
}
