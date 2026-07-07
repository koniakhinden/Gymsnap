import * as React from "react";
import { cn } from "./cn";

type Tone = "beta" | "neutral" | "success" | "warning";

const tones: Record<Tone, string> = {
  beta: "bg-accent-fill border border-accent-badge-border text-accent",
  neutral: "bg-surface-sunken text-ink-secondary",
  success: "bg-success-bg text-success",
  warning: "bg-warning-bg text-warning-ink",
};

export function Badge({
  tone = "neutral",
  className,
  children,
}: {
  tone?: Tone;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-pill px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.08em]",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
