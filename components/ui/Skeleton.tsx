import * as React from "react";
import { cn } from "./cn";
import { Card } from "./Card";

/*
 * Skeleton — shimmering placeholder. Respects prefers-reduced-motion (the
 * shimmer animation is neutralised globally in that case).
 */
const shimmer =
  "bg-[linear-gradient(90deg,#EDECEA_25%,#F6F5F3_50%,#EDECEA_75%)] bg-[length:200%_100%] " +
  "[animation:shimmer_1.5s_ease-in-out_infinite]";

export function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-md", shimmer, className)} {...props} />;
}

/** A card-shaped skeleton row: avatar + two lines. */
export function SkeletonCardRow() {
  return (
    <Card className="flex items-center gap-[13px] p-4">
      <Skeleton className="h-11 w-11 flex-shrink-0 rounded-card" />
      <div className="flex flex-1 flex-col gap-2">
        <Skeleton className="h-3.5 w-[55%] rounded-md" />
        <Skeleton className="h-3 w-[85%] rounded-md" />
      </div>
    </Card>
  );
}

/** A row of pill-shaped skeletons. */
export function SkeletonPills({ count = 3 }: { count?: number }) {
  return (
    <div className="flex gap-2">
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className="h-8 w-20 flex-shrink-0 rounded-pill" />
      ))}
    </div>
  );
}
