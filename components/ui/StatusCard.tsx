import * as React from "react";
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
 */
export function StatusCard({
  icon: Icon,
  tone = "neutral",
  title,
  subtitle,
  action,
  className,
}: {
  icon: LucideIcon;
  tone?: Tone;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn("flex items-center gap-[13px] p-4", className)}>
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
      {action != null && <div className="flex-shrink-0">{action}</div>}
    </Card>
  );
}
