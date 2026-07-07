import * as React from "react";
import { ChevronDown, CircleAlert } from "lucide-react";
import { cn } from "./cn";

const fieldBase =
  "w-full rounded-field border bg-surface px-[13px] py-[11px] text-[15px] text-ink " +
  "outline-none transition-[color,box-shadow,border-color] placeholder:text-ink-tertiary " +
  "focus:border-accent-border focus:ring-[3px] focus:ring-accent-border/20 " +
  "disabled:cursor-not-allowed disabled:bg-bg disabled:text-ink-disabled";

const errorRing =
  "border-error text-error ring-[3px] ring-error/[0.12] focus:border-error focus:ring-error/[0.12]";

/** Label + optional hint / error message wrapper for a form control. */
export function Field({
  label,
  htmlFor,
  hint,
  error,
  disabled,
  className,
  children,
}: {
  label?: React.ReactNode;
  htmlFor?: string;
  hint?: React.ReactNode;
  error?: React.ReactNode;
  disabled?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className}>
      {label != null && (
        <label
          htmlFor={htmlFor}
          className={cn(
            "mb-[7px] block text-[13px] font-semibold",
            disabled ? "text-ink-disabled" : "text-ink",
          )}
        >
          {label}
        </label>
      )}
      {children}
      {error != null ? (
        <div className="mt-1.5 flex items-center gap-1.5 text-[12px] text-error">
          <CircleAlert size={14} strokeWidth={2} />
          {error}
        </div>
      ) : (
        hint != null && (
          <div className="mt-1.5 text-[12px] text-ink-tertiary">{hint}</div>
        )
      )}
    </div>
  );
}

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }
>(function Input({ className, invalid, ...props }, ref) {
  return (
    <input
      ref={ref}
      className={cn(fieldBase, invalid ? errorRing : "border-border-strong", className)}
      {...props}
    />
  );
});

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }
>(function Textarea({ className, invalid, ...props }, ref) {
  return (
    <textarea
      ref={ref}
      className={cn(
        fieldBase,
        "resize-y",
        invalid ? errorRing : "border-border-strong",
        className,
      )}
      {...props}
    />
  );
});

export const Select = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }
>(function Select({ className, invalid, children, ...props }, ref) {
  return (
    <div className="relative">
      <select
        ref={ref}
        className={cn(
          fieldBase,
          "cursor-pointer appearance-none pr-[38px]",
          invalid ? errorRing : "border-border-strong",
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        size={18}
        strokeWidth={2}
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink-tertiary"
      />
    </div>
  );
});
