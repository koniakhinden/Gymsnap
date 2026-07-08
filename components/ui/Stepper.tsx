"use client";

import { useEffect, useState } from "react";
import { Minus, Plus } from "lucide-react";
import { cn } from "./cn";

/*
 * Stepper — −/+ number control with an editable field in the middle, so values
 * can be typed on the keyboard as well as stepped. Default tap targets are
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
  const isDecimal = step % 1 !== 0;

  // Local text state lets the user type intermediate values ("", "2.") without
  // the parent clamping mid-keystroke; we reconcile on blur. While focused we
  // don't resync from `value`, so a half-typed decimal isn't clobbered.
  const [text, setText] = useState(String(value));
  const [focused, setFocused] = useState(false);
  useEffect(() => {
    if (!focused) setText(String(value));
  }, [value, focused]);

  function commit(raw: string) {
    const n = parseFloat(raw.replace(",", "."));
    if (Number.isNaN(n)) {
      setText(String(value));
      return;
    }
    const next = clamp(round(n));
    setText(String(next));
    if (next !== value) onChange(next);
  }

  const btn = compact ? "h-10 w-9" : "h-11 w-11";
  const inputW = compact ? "w-9" : "w-14";

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

      <div className="flex items-center justify-center px-0.5">
        <input
          type="text"
          inputMode={isDecimal ? "decimal" : "numeric"}
          aria-label={ariaLabel}
          disabled={disabled}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            const n = parseFloat(e.target.value.replace(",", "."));
            if (!Number.isNaN(n)) onChange(clamp(round(n)));
          }}
          onFocus={(e) => {
            setFocused(true);
            e.currentTarget.select();
          }}
          onBlur={(e) => {
            setFocused(false);
            commit(e.target.value);
          }}
          className={cn(
            "bg-transparent text-center font-semibold tabular-nums text-ink outline-none disabled:cursor-not-allowed",
            compact ? "text-[14px]" : "text-[15px]",
            inputW,
          )}
        />
        {suffix ? (
          <span className="text-[12px] font-medium text-ink-tertiary">{suffix}</span>
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
