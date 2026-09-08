import type { ReactNode } from "react";

export function AuthSheet({
  eyebrow,
  title,
  subtitle,
  children,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <div className="auth-sheet w-full max-w-md p-7 sm:p-8">
      <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--meet-primary)]">
        {eyebrow}
      </p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-[var(--meet-text)]">
        {title}
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-[var(--meet-text-muted)]">
        {subtitle}
      </p>
      <div className="mt-7">{children}</div>
    </div>
  );
}
