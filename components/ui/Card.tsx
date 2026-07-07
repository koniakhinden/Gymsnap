import * as React from "react";
import { cn } from "./cn";

/** Base surface card — white, hairline border, soft shadow, 12px radius. */
export function Card({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-card border border-hairline bg-surface shadow-card",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
