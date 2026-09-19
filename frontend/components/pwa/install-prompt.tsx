"use client";

import { Button } from "@/components/ui/button";
import { Download, Share, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: window-controls-overlay)").matches ||
    ("standalone" in navigator &&
      Boolean((navigator as Navigator & { standalone?: boolean }).standalone))
  );
}

function isIos() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

export function InstallPrompt() {
  const pathname = usePathname();
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(
    null,
  );
  const [showIos, setShowIos] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const hideOnMeeting = pathname.startsWith("/m/");

  useEffect(() => {
    if (hideOnMeeting || isStandalone()) return;

    const dismissedAt = window.localStorage.getItem("meetme-install-dismissed");
    if (dismissedAt) {
      setDismissed(true);
      return;
    }

    if (isIos()) {
      setShowIos(true);
      return;
    }

    const onPrompt = (event: Event) => {
      event.preventDefault();
      setDeferred(event as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, [hideOnMeeting]);

  function dismiss() {
    setDeferred(null);
    setShowIos(false);
    setDismissed(true);
    window.localStorage.setItem("meetme-install-dismissed", "1");
  }

  async function install() {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    setDeferred(null);
    window.localStorage.setItem("meetme-install-dismissed", "1");
  }

  if (hideOnMeeting || dismissed || (!deferred && !showIos)) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex justify-center p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:p-4">
      <div className="pointer-events-auto flex w-full max-w-lg items-start gap-3 rounded-2xl border border-[var(--meet-border)] bg-[var(--meet-surface)] p-4 shadow-[var(--meet-shadow)]">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--meet-primary-strong)] text-sm font-bold text-white">
          M
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-[var(--meet-text)]">
            Install MeetMe
          </p>
          {showIos ? (
            <p className="mt-1 text-sm text-[var(--meet-text-muted)]">
              Tap <Share className="mx-0.5 inline h-3.5 w-3.5" /> Share, then{" "}
              <strong>Add to Home Screen</strong> to use it like an app.
            </p>
          ) : (
            <p className="mt-1 text-sm text-[var(--meet-text-muted)]">
              Add it to your home screen for faster meetings on phone and tablet.
            </p>
          )}
          {deferred ? (
            <Button size="sm" className="mt-3" onClick={() => void install()}>
              <Download className="h-4 w-4" />
              Install app
            </Button>
          ) : null}
        </div>
        <button
          type="button"
          onClick={dismiss}
          className="rounded-full p-1 text-[var(--meet-text-muted)] hover:bg-[var(--meet-primary-soft)]"
          aria-label="Dismiss install prompt"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
