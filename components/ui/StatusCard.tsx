import * as React from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { cn } from "./cn";
import { Card } from "./Card";

type Tone = "neutral" | "success" | "warning" | "error" | "accent";

const wells: Record<Tone, string> = {
  neutral: "bg-surface-sunken text-ink-secondary",
  success: "bg-success-bg text-success",
  warning: "bg-warning-bg text-warning",
  error: "bg-error-bg text-error",
  accent: "bg-accent-fill text-accent",
};

/*
 * StatusCard — icon well · title · status · optional action.
 * Semantics are carried by the icon tone, per the design system.
 *
 * When `href` is set the WHOLE card is the tap target (a single Link, ≥44px),
 * and `action` becomes a non-interactive visual affordance (label + chevron).
 */
export function StatusCard({
  icon: Icon,
  tone = "neutral",
  title,
  subtitle,
  action,
  href,
  className,
}: {
  icon: LucideIcon;
  tone?: Tone;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
  href?: string;
  className?: string;
}) {
  const inner = (
    <>
      <div
        className={cn(
          "flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-card",
          wells[tone],
        )}
      >
        <Icon size={20} strokeWidth={2} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[15px] font-semibold text-ink">{title}</div>
        {subtitle != null && (
          <div className="mt-0.5 text-[13px] text-ink-secondary">{subtitle}</div>
        )}
      </div>
      {action != null && (
        <div className="flex-shrink-0" aria-hidden={href ? true : undefined}>
          {action}
        </div>
      )}
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        className={cn(
          "flex items-center gap-[13px] rounded-card border border-hairline bg-surface p-4 shadow-card transition-colors",
          "hover:bg-surface-sunken/40 active:bg-surface-sunken",
          "outline-none focus-visible:ring-[3px] focus-visible:ring-accent-border/40",
          className,
        )}
      >
        {inner}
      </Link>
    );
  }

  return (
    <Card className={cn("flex items-center gap-[13px] p-4", className)}>
      {inner}
    </Card>
  );
}
