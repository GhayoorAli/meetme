import Link from "next/link";

export function Logo({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const sizes = {
    sm: "text-lg",
    md: "text-xl",
    lg: "text-3xl",
  };

  return (
    <Link href="/" className="inline-flex items-center gap-2.5 group">
      <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-[var(--meet-primary-strong)] text-sm font-bold text-white shadow-[0_0_0_3px_var(--meet-primary-soft)]">
        M
      </span>
      <span
        className={`font-semibold tracking-tight text-[var(--meet-text)] transition-colors group-hover:text-[var(--meet-primary)] max-[380px]:hidden ${sizes[size]}`}
      >
        MeetMe
      </span>
    </Link>
  );
}
