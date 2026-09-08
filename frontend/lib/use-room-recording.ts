"use client";

import { setLocalRecordingLoad } from "@/lib/livekit-options";
import type { Room } from "livekit-client";
import { useCallback, useEffect, useRef, useState } from "react";

type RecordingState = "idle" | "recording" | "stopping";

const RECORD_WIDTH = 640;
const RECORD_HEIGHT = 360;
const RECORD_FPS = 6;
const FRAME_MS = 1000 / RECORD_FPS;
const VIDEO_SCAN_MS = 1000;

function stageVideos(): HTMLVideoElement[] {
  const share = document.querySelector<HTMLVideoElement>(
    '.meet-video-well [data-lk-source="screen_share"] video',
  );
  if (share && share.videoWidth > 0) return [share];

  return Array.from(
    document.querySelectorAll<HTMLVideoElement>(".meet-video-well video"),
  ).filter((video) => video.videoWidth > 0);
}

function collectAudioTracks(room: Room): MediaStreamTrack[] {
  const tracks: MediaStreamTrack[] = [];
  const add = (track?: MediaStreamTrack) => {
    if (track && track.readyState === "live") tracks.push(track);
  };

  room.localParticipant.audioTrackPublications.forEach((pub) => {
    add(pub.track?.mediaStreamTrack);
  });
  room.remoteParticipants.forEach((participant) => {
    participant.audioTrackPublications.forEach((pub) => {
      add(pub.track?.mediaStreamTrack);
    });
  });
  return tracks;
}

function drawCover(
  ctx: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  x: number,
  y: number,
  cellW: number,
  cellH: number,
) {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if (vw < 2 || vh < 2) return;

  const scale = Math.max(cellW / vw, cellH / vh);
  const dw = vw * scale;
  const dh = vh * scale;
  const dx = x + (cellW - dw) / 2;
  const dy = y + (cellH - dh) / 2;
  ctx.drawImage(video, dx, dy, dw, dh);
}

function buildCompositeStream(
  room: Room,
): { stream: MediaStream; cleanup: () => void } {
  const canvas = document.createElement("canvas");
  canvas.width = RECORD_WIDTH;
  canvas.height = RECORD_HEIGHT;
  const ctx = canvas.getContext("2d", {
    alpha: false,
    desynchronized: true,
  });
  if (!ctx) {
    throw new Error("Could not start recording.");
  }

  let timer = 0;
  let running = true;
  let lastScan = 0;
  let videos: HTMLVideoElement[] = [];
  const clonedAudio: MediaStreamTrack[] = [];

  const draw = () => {
    if (!running || document.hidden) return;

    const now = performance.now();
    if (now - lastScan >= VIDEO_SCAN_MS || videos.length === 0) {
      videos = stageVideos();
      lastScan = now;
    }

    ctx.fillStyle = "#111827";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (videos.length === 0) return;

    const cols = Math.min(videos.length, 2);
    const rows = Math.ceil(videos.length / cols);
    const cellW = canvas.width / cols;
    const cellH = canvas.height / rows;

    videos.forEach((video, index) => {
      if (video.readyState < 2) return;
      const col = index % cols;
      const row = Math.floor(index / cols);
      drawCover(ctx, video, col * cellW, row * cellH, cellW, cellH);
    });
  };

  const schedule = () => {
    if (!running) return;
    timer = window.setTimeout(() => {
      draw();
      schedule();
    }, FRAME_MS);
  };

  const onVisibility = () => {
    if (!document.hidden) draw();
  };
  document.addEventListener("visibilitychange", onVisibility);
  schedule();

  const canvasStream = canvas.captureStream(RECORD_FPS);
  const outputStream = new MediaStream(canvasStream.getVideoTracks());

  let audioContext: AudioContext | null = null;
  const audioTracks = collectAudioTracks(room);
  if (audioTracks.length > 0) {
    audioContext = new AudioContext({ latencyHint: "playback" });
    const destination = audioContext.createMediaStreamDestination();
    audioTracks.forEach((track) => {
      const clone = track.clone();
      clonedAudio.push(clone);
      const source = audioContext!.createMediaStreamSource(
        new MediaStream([clone]),
      );
      source.connect(destination);
    });
    destination.stream.getAudioTracks().forEach((track) => {
      outputStream.addTrack(track);
    });
  }

  let cleaned = false;
  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    running = false;
    window.clearTimeout(timer);
    document.removeEventListener("visibilitychange", onVisibility);
    outputStream.getTracks().forEach((track) => track.stop());
    clonedAudio.forEach((track) => track.stop());
    void audioContext?.close();
  };

  return { stream: outputStream, cleanup };
}

function pickRecorderMimeType(): string {
  const candidates = [
    "video/webm;codecs=vp8,opus",
    "video/webm;codecs=vp9,opus",
    "video/webm",
  ];
  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) ?? "";
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function useRoomRecording(room: Room | undefined, meetingCode: string) {
  const [state, setState] = useState<RecordingState>("idle");
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const cleanupRef = useRef<(() => void) | null>(null);

  const releaseLoad = useCallback(() => {
    if (room) setLocalRecordingLoad(room.localParticipant, false);
  }, [room]);

  const startRecording = useCallback(() => {
    if (!room || state === "recording") return;

    const { stream, cleanup } = buildCompositeStream(room);
    cleanupRef.current = cleanup;

    const mimeType = pickRecorderMimeType();
    const recorder = new MediaRecorder(stream, {
      ...(mimeType ? { mimeType } : {}),
      videoBitsPerSecond: 400_000,
      audioBitsPerSecond: 48_000,
    });

    chunksRef.current = [];

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        chunksRef.current.push(event.data);
      }
    };

    recorder.onstop = () => {
      cleanupRef.current?.();
      cleanupRef.current = null;
      releaseLoad();

      const blob = new Blob(chunksRef.current, {
        type: mimeType || "video/webm",
      });
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      downloadBlob(blob, `meetme-${meetingCode}-${timestamp}.webm`);
      chunksRef.current = [];
      recorderRef.current = null;
      setState("idle");
    };

    recorder.start(4000);
    recorderRef.current = recorder;
    setLocalRecordingLoad(room.localParticipant, true);
    setState("recording");
  }, [room, meetingCode, state, releaseLoad]);

  const stopRecording = useCallback(() => {
    if (recorderRef.current && state === "recording") {
      setState("stopping");
      recorderRef.current.stop();
    }
  }, [state]);

  useEffect(() => {
    return () => {
      if (recorderRef.current && recorderRef.current.state !== "inactive") {
        recorderRef.current.stop();
      }
      cleanupRef.current?.();
      cleanupRef.current = null;
      releaseLoad();
    };
  }, [releaseLoad]);

  return {
    state,
    isRecording: state === "recording",
    startRecording,
    stopRecording,
  };
}
