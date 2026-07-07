"use client";

import * as React from "react";
import { cn } from "./cn";

export interface SegmentOption<T extends string> {
  value: T;
  label: React.ReactNode;
}

/*
 * SegmentControl — single-select control on a sunken track. Active segment gets
 * a raised white surface. Controlled via value/onChange.
 */
export function SegmentControl<T extends string>({
  options,
  value,
  onChange,
  className,
}: {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}) {
  return (
    <div
      role="tablist"
      className={cn(
        "flex gap-1 rounded-card bg-surface-sunken p-1",
        className,
      )}
    >
      {options.map((opt) => {
        const on = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => onChange(opt.value)}
            className={cn(
              "flex-1 rounded-lg px-0 py-[9px] text-center text-sm transition-all outline-none",
              "focus-visible:ring-[3px] focus-visible:ring-accent-border/40",
              on
                ? "bg-surface font-semibold text-ink shadow-[0_1px_2px_rgba(0,0,0,0.08)]"
                : "font-medium text-ink-secondary",
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
