import { cn } from "@/lib/utils";
import { forwardRef, type ButtonHTMLAttributes } from "react";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
};

const variants = {
  primary:
    "bg-[var(--meet-primary-strong)] text-white hover:bg-[#1765cc] shadow-sm",
  secondary:
    "bg-[var(--meet-surface-elevated)] text-[var(--meet-text)] hover:bg-[#4a4d51] border border-[var(--meet-border)]",
  ghost:
    "bg-transparent text-[var(--meet-text)] hover:bg-[var(--meet-surface)]",
  danger: "bg-[var(--meet-danger)] text-white hover:opacity-90",
};

const sizes = {
  sm: "h-9 px-4 text-sm",
  md: "h-11 px-6 text-sm font-medium",
  lg: "h-12 px-8 text-base font-medium",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = "primary",
      size = "md",
      loading,
      disabled,
      children,
      ...props
    },
    ref,
  ) => (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    >
      {loading ? (
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
      ) : null}
      {children}
    </button>
  ),
);

Button.displayName = "Button";
