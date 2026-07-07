import * as React from "react";
import { cn } from "./cn";

type Variant = "primary" | "secondary" | "ghost";
type Size = "md" | "lg";

/*
 * Button — one primary style for the whole app (dark #1C1917); teal is reserved
 * for selection/activity, so there is only ever one strong CTA on a screen.
 * States: default / hover / active / focus (teal ring) / disabled / loading.
 */
const base =
  "inline-flex items-center justify-center gap-2 rounded-btn font-semibold " +
  "cursor-pointer select-none transition-colors outline-none " +
  "focus-visible:ring-[3px] focus-visible:ring-accent-border/40 " +
  "disabled:cursor-not-allowed";

const sizes: Record<Size, string> = {
  md: "px-[18px] py-[11px] text-[15px]",
  lg: "px-[18px] py-[15px] text-base",
};

const variants: Record<Variant, string> = {
  primary:
    "border border-primary bg-primary text-white " +
    "hover:bg-primary-hover hover:border-primary-hover active:bg-primary-active " +
    "disabled:bg-border disabled:border-border disabled:text-ink-disabled",
  secondary:
    "border border-border-strong bg-surface text-ink " +
    "hover:bg-bg hover:border-ink-disabled active:bg-surface-sunken " +
    "disabled:bg-surface disabled:border-border disabled:text-ink-disabled",
  ghost:
    "border border-transparent bg-transparent text-ink " +
    "hover:bg-surface-sunken active:bg-border " +
    "disabled:bg-transparent disabled:text-ink-disabled",
};

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  block?: boolean;
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      variant = "primary",
      size = "md",
      block,
      loading,
      disabled,
      className,
      children,
      ...props
    },
    ref,
  ) {
    const spinnerTone =
      variant === "primary"
        ? "border-white/35 border-t-white"
        : "border-border border-t-ink-secondary";
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(
          base,
          sizes[size],
          variants[variant],
          block && "w-full",
          className,
        )}
        {...props}
      >
        {loading && (
          <span
            aria-hidden
            className={cn(
              "inline-block h-4 w-4 rounded-full border-2 [animation:spin_0.7s_linear_infinite]",
              spinnerTone,
            )}
          />
        )}
        {children}
      </button>
    );
  },
);
