"use client";

import { Button } from "@/components/ui/button";
import {
  BackgroundProcessor,
  supportsBackgroundProcessors,
} from "@livekit/track-processors";
import { useLocalParticipant } from "@livekit/components-react";
import { Track } from "livekit-client";
import { Sparkles } from "lucide-react";
import { useEffect, useState } from "react";

type BgMode = "none" | "blur-light" | "blur-strong";

const MODES: { id: BgMode; label: string }[] = [
  { id: "none", label: "None" },
  { id: "blur-light", label: "Blur" },
  { id: "blur-strong", label: "Strong blur" },
];

export function BackgroundControls() {
  const { localParticipant } = useLocalParticipant();
  const [mode, setMode] = useState<BgMode>("none");
  const [supported, setSupported] = useState(true);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setSupported(supportsBackgroundProcessors());
  }, []);

  async function applyMode(next: BgMode) {
    if (!supported || busy) return;
    setBusy(true);
    try {
      const publication = localParticipant.getTrackPublication(Track.Source.Camera);
      const track = publication?.track;
      if (!track || track.kind !== "video") {
        return;
      }

      await track.stopProcessor();

      if (next === "none") {
        setMode(next);
        return;
      }

      const blurRadius = next === "blur-light" ? 12 : 24;
      const processor = BackgroundProcessor({
        mode: "background-blur",
        blurRadius,
      });
      await track.setProcessor(processor);
      setMode(next);
    } catch {
      setSupported(false);
    } finally {
      setBusy(false);
    }
  }

  if (!supported) return null;

  return (
    <div className="relative">
      <Button
        size="sm"
        variant={mode === "none" ? "secondary" : "primary"}
        onClick={() => setOpen((v) => !v)}
      >
        <Sparkles className="h-4 w-4" />
        Background
      </Button>

      {open ? (
        <div className="absolute right-0 top-11 z-30 min-w-[180px] rounded-xl border border-[var(--meet-border)] bg-[var(--meet-surface)] p-2 shadow-xl">
          {MODES.map((item) => (
            <button
              key={item.id}
              type="button"
              disabled={busy}
              onClick={() => {
                applyMode(item.id);
                setOpen(false);
              }}
              className={`flex w-full items-center rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                mode === item.id
                  ? "bg-[var(--meet-primary-strong)]/20 text-[var(--meet-primary)]"
                  : "text-[var(--meet-text)] hover:bg-[var(--meet-bg)]"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
