import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "./cn";

/*
 * EmptyState — centered icon medallion, title, supporting copy, optional action.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon: LucideIcon;
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("px-4 py-6 text-center", className)}>
      <div className="mb-3.5 inline-flex h-16 w-16 items-center justify-center rounded-full bg-accent-fill text-accent">
        <Icon size={30} strokeWidth={1.8} />
      </div>
      <div className="mb-1.5 text-base font-semibold text-ink">{title}</div>
      {description != null && (
        <p className="mx-auto mb-4 max-w-[260px] text-sm leading-[1.5] text-ink-secondary text-pretty">
          {description}
        </p>
      )}
      {action}
    </div>
  );
}
