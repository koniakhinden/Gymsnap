"use client";

import * as React from "react";
import { Check, Info } from "lucide-react";
import { cn } from "./cn";

/*
 * OptionCard — wizard option with radio behaviour.
 * Selected → teal fill + border and a filled radio. Disabled options stay
 * visible and explain why they are unavailable.
 */
export function OptionCard({
  selected,
  disabled,
  title,
  desc,
  reason,
  onSelect,
  name,
}: {
  selected?: boolean;
  disabled?: boolean;
  title: React.ReactNode;
  desc?: React.ReactNode;
  reason?: React.ReactNode;
  onSelect?: () => void;
  /** Optional radiogroup name, for a11y semantics. */
  name?: string;
}) {
  return (
    <div
      role="radio"
      aria-checked={!!selected}
      aria-disabled={disabled || undefined}
      data-name={name}
      tabIndex={disabled ? -1 : 0}
      onClick={disabled ? undefined : onSelect}
      onKeyDown={(e) => {
        if (disabled) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect?.();
        }
      }}
      className={cn(
        "flex items-start gap-[13px] rounded-card border-[1.5px] p-4 transition-colors outline-none",
        "focus-visible:ring-[3px] focus-visible:ring-accent-border/40",
        disabled
          ? "cursor-not-allowed border-border bg-bg"
          : selected
            ? "cursor-pointer border-accent-border bg-accent-fill"
            : "cursor-pointer border-border bg-surface hover:border-ink-disabled",
      )}
    >
      <span
        className={cn(
          "mt-px flex h-[22px] w-[22px] flex-shrink-0 items-center justify-center rounded-full border-2",
          selected
            ? "border-accent bg-accent"
            : disabled
              ? "border-border bg-surface"
              : "border-border-strong bg-surface",
        )}
      >
        {selected && <Check size={13} strokeWidth={3.5} className="text-white" />}
      </span>
      <div className="min-w-0 flex-1">
        <div
          className={cn(
            "text-[15px] font-semibold",
            disabled ? "text-ink-disabled" : "text-ink",
          )}
        >
          {title}
        </div>
        {desc != null && (
          <div
            className={cn(
              "mt-0.5 text-[13px] leading-[1.4]",
              disabled ? "text-ink-disabled" : "text-ink-secondary",
            )}
          >
            {desc}
          </div>
        )}
        {disabled && reason != null && (
          <div className="mt-2 flex items-start gap-1.5 rounded-lg bg-warning-bg px-2.5 py-2">
            <Info
              size={15}
              strokeWidth={2}
              className="mt-px flex-shrink-0 text-warning"
            />
            <span className="text-[12px] leading-[1.4] text-warning-ink">
              {reason}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
