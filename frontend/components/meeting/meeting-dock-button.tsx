import { cn } from "@/lib/utils";
import type { ButtonHTMLAttributes, ReactNode } from "react";

type MeetingDockButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  active?: boolean;
  danger?: boolean;
  loading?: boolean;
  badge?: ReactNode;
};

export function MeetingDockButton({
  active,
  danger,
  loading,
  badge,
  className,
  disabled,
  children,
  ...props
}: MeetingDockButtonProps) {
  return (
    <button
      type="button"
      disabled={disabled || loading}
      className={cn(
        "meet-dock-btn",
        active && "is-active",
        danger && "is-danger",
        className,
      )}
      {...props}
    >
      {loading ? (
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
      ) : (
        children
      )}
      {badge ? <span className="meet-dock-badge">{badge}</span> : null}
    </button>
  );
}
