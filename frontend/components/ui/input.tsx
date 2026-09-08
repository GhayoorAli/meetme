import { cn } from "@/lib/utils";
import { forwardRef, type InputHTMLAttributes } from "react";

type InputProps = InputHTMLAttributes<HTMLInputElement>;

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "h-11 w-full rounded-xl border border-[var(--meet-border)] bg-[var(--meet-surface-elevated)] px-4 text-[var(--meet-text)] placeholder:text-[var(--meet-text-muted)] outline-none transition-colors focus:border-[var(--meet-primary)] focus:ring-2 focus:ring-[var(--meet-primary)]/15",
        className,
      )}
      {...props}
    />
  ),
);

Input.displayName = "Input";
