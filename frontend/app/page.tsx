import { Header } from "@/components/layout/header";
import { HeroBackdrop } from "@/components/landing/hero-backdrop";
import { HomeCta } from "@/components/landing/home-cta";
import { Video, Users, Shield, Zap } from "lucide-react";

const FEATURES = [
  {
    icon: Video,
    title: "HD in the room",
    desc: "LiveKit video and audio that stays clear when the group grows.",
  },
  {
    icon: Users,
    title: "Up to 30 people",
    desc: "Friends, standups, and small communities — one shared room.",
  },
  {
    icon: Zap,
    title: "A room in one click",
    desc: "Host signed-in or as a guest. Share a short code, not a calendar.",
  },
  {
    icon: Shield,
    title: "The host decides",
    desc: "Waiting room, recording, and screen-share stay under your control.",
  },
] as const;

export default function HomePage() {
  return (
    <div className="relative flex min-h-full flex-col">
      <div className="meet-atmosphere meet-atmosphere-page" aria-hidden />
      <Header />

      <main className="relative z-10 flex-1">
        <div className="relative min-h-[calc(100dvh-3.5rem)] sm:min-h-[calc(100dvh-4rem)]">
          <HeroBackdrop />
          <section className="relative z-10 mx-auto flex min-h-[calc(100dvh-3.5rem)] max-w-6xl flex-col justify-center px-4 py-10 sm:min-h-[calc(100dvh-4rem)] sm:px-6 sm:py-16 lg:max-w-7xl">
            <div className="max-w-xl">
              <p className="inline-flex items-center gap-2 rounded-full border border-[var(--meet-border)] bg-white/70 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--meet-primary-strong)]">
                Live video rooms
              </p>
              <h1 className="mt-5 text-3xl font-semibold leading-[1.05] tracking-tight text-[var(--meet-text)] sm:text-5xl lg:text-[3.6rem]">
                The call feels
                <span className="mt-1 block bg-gradient-to-r from-[var(--meet-primary)] to-[var(--meet-accent)] bg-clip-text text-transparent">
                  like everyone is here.
                </span>
              </h1>
              <p className="mt-5 max-w-md text-base leading-relaxed text-[var(--meet-text-muted)] sm:text-lg">
                MeetMe is a room you own — unlimited time, a waiting room, and
                host controls. No free-tier clock. No extra apps.
              </p>
              <HomeCta />
            </div>
          </section>
        </div>

        <section className="relative z-10 mx-3 mb-8 rounded-[1.5rem] bg-[var(--meet-surface)] px-4 py-10 sm:mx-5 sm:rounded-[2rem] sm:px-6 sm:py-20 lg:px-10">
          <div className="mx-auto max-w-6xl">
            <div className="grid gap-12 lg:grid-cols-[0.85fr_1.15fr] lg:gap-20">
              <div className="lg:sticky lg:top-24 lg:self-start">
                <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-[var(--meet-primary)]">
                  In the room
                </p>
                <h2 className="mt-3 text-3xl font-semibold tracking-tight text-[var(--meet-text)] sm:text-4xl">
                  Presence first.
                  <span className="block text-[var(--meet-text-muted)]">
                    Tools stay out of the way.
                  </span>
                </h2>
              </div>

              <ol className="divide-y divide-[var(--meet-border)] border-y border-[var(--meet-border)]">
                {FEATURES.map(({ icon: Icon, title, desc }, index) => (
                  <li
                    key={title}
                    className="grid gap-4 py-8 sm:grid-cols-[auto_1fr] sm:items-start sm:gap-8"
                  >
                    <span className="font-mono text-sm text-[var(--meet-primary)]">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <div>
                      <div className="flex items-center gap-3">
                        <Icon className="h-4 w-4 text-[var(--meet-accent)]" />
                        <h3 className="text-xl font-semibold tracking-tight text-[var(--meet-text)]">
                          {title}
                        </h3>
                      </div>
                      <p className="mt-2 max-w-md text-[var(--meet-text-muted)]">
                        {desc}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </section>
      </main>

      <footer className="relative z-10 px-4 pb-[max(5.5rem,env(safe-area-inset-bottom))] pt-8 text-center text-sm text-[var(--meet-text-muted)]">
        MeetMe — rooms you actually own
      </footer>
    </div>
  );
}
