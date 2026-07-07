"use client";

import * as React from "react";
import { Check } from "lucide-react";
import { cn } from "./cn";

/*
 * Pill — selectable chip (multi-select). Selected → teal fill + border + check.
 * Compose several inside a flex-wrap row for a pill selector.
 */
export function Pill({
  selected,
  disabled,
  onClick,
  children,
}: {
  selected?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={!!selected}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "inline-flex select-none items-center gap-1.5 rounded-pill border px-[15px] py-[9px] text-sm font-medium transition-colors outline-none",
        "focus-visible:ring-[3px] focus-visible:ring-accent-border/40",
        "disabled:cursor-not-allowed disabled:opacity-50",
        selected
          ? "border-accent-border bg-accent-fill text-accent-hover"
          : "border-border bg-surface text-ink-secondary hover:border-ink-disabled",
      )}
    >
      {selected && <Check size={14} strokeWidth={3} className="text-accent" />}
      {children}
    </button>
  );
}

/** Convenience wrapper — a wrapping row of pills. */
export function PillGroup({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return <div className={cn("flex flex-wrap gap-2", className)}>{children}</div>;
}
