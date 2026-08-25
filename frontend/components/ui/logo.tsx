import Link from "next/link";

export function Logo({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const sizes = {
    sm: "text-lg",
    md: "text-xl",
    lg: "text-3xl",
  };

  return (
    <Link href="/" className="inline-flex items-center gap-2 group">
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--meet-primary-strong)] text-white font-bold text-sm">
        M
      </span>
      <span
        className={`font-semibold tracking-tight text-[var(--meet-text)] group-hover:text-[var(--meet-primary)] transition-colors ${sizes[size]}`}
      >
        MeetMe
      </span>
    </Link>
  );
}
