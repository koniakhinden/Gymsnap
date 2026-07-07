"use client";

import * as React from "react";
import { X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "./cn";

type Tone = "neutral" | "warning" | "accent";

const wells: Record<Tone, string> = {
  neutral: "bg-surface-sunken text-ink-secondary",
  warning: "bg-warning-bg text-warning",
  accent: "bg-accent-fill text-accent",
};

/*
 * Modal — bottom sheet on mobile, centered card on larger screens. Overlay
 * click and Escape close it; body scroll is locked while open.
 */
export function Modal({
  open,
  onClose,
  title,
  icon: Icon,
  tone = "neutral",
  footer,
  children,
  dismissible = true,
}: {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  icon?: LucideIcon;
  tone?: Tone;
  footer?: React.ReactNode;
  children: React.ReactNode;
  /** When false, the overlay/Escape/close button do not dismiss (blocking). */
  dismissible?: boolean;
}) {
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (dismissible && e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose, dismissible]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={dismissible ? onClose : undefined}
      className="fixed inset-0 z-[100] flex items-end justify-center bg-[rgba(28,25,23,0.5)] p-0 sm:items-center sm:p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[90vh] w-full max-w-[420px] flex-col overflow-hidden rounded-t-[20px] bg-surface shadow-modal sm:rounded-modal"
      >
        {(title != null || dismissible) && (
          <div className="flex items-start justify-between gap-3 px-5 pt-5">
            <div className="flex items-center gap-2.5">
              {Icon && (
                <div
                  className={cn(
                    "flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-card",
                    wells[tone],
                  )}
                >
                  <Icon size={20} strokeWidth={2} />
                </div>
              )}
              {title != null && (
                <div className="text-lg font-semibold tracking-[-0.01em] text-ink">
                  {title}
                </div>
              )}
            </div>
            {dismissible && (
              <button
                type="button"
                aria-label="Close"
                onClick={onClose}
                className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-surface-sunken text-ink-secondary transition-colors hover:bg-border"
              >
                <X size={18} strokeWidth={2} />
              </button>
            )}
          </div>
        )}
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer != null && <div className="px-5 pb-5 pt-1">{footer}</div>}
      </div>
    </div>
  );
}
