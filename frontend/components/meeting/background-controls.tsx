"use client";

import {
  BackgroundProcessor,
  supportsBackgroundProcessors,
} from "@livekit/track-processors";
import { useLocalParticipant, useTracks } from "@livekit/components-react";
import { Track } from "livekit-client";
import { subscribeMeetingEncoderLoad } from "@/lib/livekit-options";
import { useCallback, useEffect, useRef, useState } from "react";

export type BgMode = "none" | "blur-light" | "blur-strong";

export const BACKGROUND_MODES: { id: BgMode; label: string }[] = [
  { id: "none", label: "None" },
  { id: "blur-light", label: "Blur" },
  { id: "blur-strong", label: "Strong blur" },
];

export function useBackgroundEffects() {
  const { localParticipant } = useLocalParticipant();
  const [mode, setMode] = useState<BgMode>("none");
  const [supported, setSupported] = useState(true);
  const [busy, setBusy] = useState(false);
  const modeRef = useRef(mode);
  const busyRef = useRef(busy);
  const pausedRef = useRef(false);

  const screenShares = useTracks(
    [{ source: Track.Source.ScreenShare, withPlaceholder: false }],
    { onlySubscribed: true },
  );
  const shareActive = screenShares.length > 0;
  const [recordingHeavy, setRecordingHeavy] = useState(false);

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  useEffect(() => {
    busyRef.current = busy;
  }, [busy]);

  useEffect(() => {
    setSupported(supportsBackgroundProcessors());
  }, []);

  useEffect(() => {
    return subscribeMeetingEncoderLoad(setRecordingHeavy);
  }, []);

  const applyMode = useCallback(
    async (next: BgMode) => {
      if (!supported || busyRef.current) return;
      busyRef.current = true;
      setBusy(true);
      try {
        const publication = localParticipant.getTrackPublication(
          Track.Source.Camera,
        );
        const track = publication?.track;
        if (!track || track.kind !== "video") {
          return;
        }

        await track.stopProcessor();

        if (next === "none" || pausedRef.current) {
          setMode(next === "none" ? "none" : next);
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
        busyRef.current = false;
        setBusy(false);
      }
    },
    [localParticipant, supported],
  );

  useEffect(() => {
    const heavy = shareActive || recordingHeavy;
    if (heavy === pausedRef.current) return;
    pausedRef.current = heavy;

    const publication = localParticipant.getTrackPublication(Track.Source.Camera);
    const track = publication?.track;
    if (!track || track.kind !== "video") return;

    if (heavy) {
      void track.stopProcessor();
      return;
    }

    if (modeRef.current !== "none") {
      void applyMode(modeRef.current);
    }
  }, [applyMode, localParticipant, recordingHeavy, shareActive]);

  return { mode, supported, busy, applyMode };
}
