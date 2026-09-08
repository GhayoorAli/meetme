const POINTS = [
  "Unlimited time — the room stays open as long as you need.",
  "Waiting room and guest hosting, without a second app.",
  "Recording and screen-share stay under the host.",
] as const;

export function AuthBrand() {
  return (
    <div className="relative mx-auto flex w-full max-w-md flex-col justify-center lg:mx-0">
      <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-[var(--meet-primary)]">
        MeetMe
      </p>
      <h2 className="mt-4 max-w-md text-3xl font-semibold leading-[1.1] tracking-tight text-[var(--meet-text)] sm:text-4xl">
        Walk into a room that already feels like yours.
      </h2>
      <ul className="mt-10 max-w-sm space-y-5">
        {POINTS.map((point) => (
          <li
            key={point}
            className="border-l-2 border-[var(--meet-primary)]/35 pl-4 text-sm leading-relaxed text-[var(--meet-text-muted)]"
          >
            {point}
          </li>
        ))}
      </ul>
    </div>
  );
}
