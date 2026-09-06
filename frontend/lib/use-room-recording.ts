"use client";

import type { Room, RemoteParticipant, LocalParticipant } from "livekit-client";
import { useCallback, useRef, useState } from "react";

type RecordingState = "idle" | "recording" | "stopping";

const RECORD_WIDTH = 960;
const RECORD_HEIGHT = 540;
const RECORD_FPS = 15;

function collectMediaTracks(room: Room): {
  videoTracks: MediaStreamTrack[];
  audioTracks: MediaStreamTrack[];
} {
  const videoTracks: MediaStreamTrack[] = [];
  const audioTracks: MediaStreamTrack[] = [];

  const addParticipantTracks = (
    participant: LocalParticipant | RemoteParticipant,
  ) => {
    participant.audioTrackPublications.forEach((pub) => {
      if (pub.track?.mediaStreamTrack) {
        audioTracks.push(pub.track.mediaStreamTrack);
      }
    });
    participant.videoTrackPublications.forEach((pub) => {
      if (pub.track?.mediaStreamTrack) {
        videoTracks.push(pub.track.mediaStreamTrack);
      }
    });
  };

  addParticipantTracks(room.localParticipant);
  room.remoteParticipants.forEach(addParticipantTracks);

  return { videoTracks, audioTracks };
}

function buildCompositeStream(
  videoTracks: MediaStreamTrack[],
  audioTracks: MediaStreamTrack[],
): { stream: MediaStream; cleanup: () => void } {
  const canvas = document.createElement("canvas");
  canvas.width = RECORD_WIDTH;
  canvas.height = RECORD_HEIGHT;
  const ctx = canvas.getContext("2d", { alpha: false })!;

  const videoElements = videoTracks.map((track) => {
    const el = document.createElement("video");
    el.srcObject = new MediaStream([track]);
    el.muted = true;
    el.playsInline = true;
    el.play().catch(() => {});
    return el;
  });

  let timerId = 0;
  const frameIntervalMs = 1000 / RECORD_FPS;

  const drawFrame = () => {
    ctx.fillStyle = "#202124";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const count = Math.max(videoElements.length, 1);
    const cols = Math.ceil(Math.sqrt(count));
    const rows = Math.ceil(count / cols);
    const cellW = canvas.width / cols;
    const cellH = canvas.height / rows;

    videoElements.forEach((video, index) => {
      const col = index % cols;
      const row = Math.floor(index / cols);
      const x = col * cellW;
      const y = row * cellH;

      if (video.readyState >= 2) {
        ctx.drawImage(video, x, y, cellW, cellH);
      } else {
        ctx.fillStyle = "#3c4043";
        ctx.fillRect(x, y, cellW, cellH);
      }
    });

    timerId = window.setTimeout(drawFrame, frameIntervalMs);
  };

  drawFrame();

  const canvasStream = canvas.captureStream(RECORD_FPS);
  const outputStream = new MediaStream(canvasStream.getVideoTracks());

  let audioContext: AudioContext | null = null;
  if (audioTracks.length > 0) {
    audioContext = new AudioContext();
    const destination = audioContext.createMediaStreamDestination();
    audioTracks.forEach((track) => {
      const source = audioContext!.createMediaStreamSource(
        new MediaStream([track]),
      );
      source.connect(destination);
    });
    destination.stream.getAudioTracks().forEach((track) => {
      outputStream.addTrack(track);
    });
  }

  const cleanup = () => {
    window.clearTimeout(timerId);
    videoElements.forEach((el) => {
      el.srcObject = null;
    });
    outputStream.getTracks().forEach((track) => track.stop());
    audioContext?.close();
  };

  return { stream: outputStream, cleanup };
}

function pickRecorderMimeType(): string {
  // VP8 is lighter on CPU than VP9 during an active call.
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

  const startRecording = useCallback(() => {
    if (!room || state === "recording") return;

    const { videoTracks, audioTracks } = collectMediaTracks(room);
    if (videoTracks.length === 0 && audioTracks.length === 0) {
      throw new Error("No media tracks available to record.");
    }

    const { stream, cleanup } = buildCompositeStream(videoTracks, audioTracks);
    cleanupRef.current = cleanup;

    const mimeType = pickRecorderMimeType();
    const recorder = mimeType
      ? new MediaRecorder(stream, {
          mimeType,
          videoBitsPerSecond: 1_200_000,
        })
      : new MediaRecorder(stream, { videoBitsPerSecond: 1_200_000 });

    chunksRef.current = [];

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        chunksRef.current.push(event.data);
      }
    };

    recorder.onstop = () => {
      cleanupRef.current?.();
      cleanupRef.current = null;

      const blob = new Blob(chunksRef.current, {
        type: mimeType || "video/webm",
      });
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      downloadBlob(blob, `meetme-${meetingCode}-${timestamp}.webm`);
      chunksRef.current = [];
      recorderRef.current = null;
      setState("idle");
    };

    recorder.start(1000);
    recorderRef.current = recorder;
    setState("recording");
  }, [room, meetingCode, state]);

  const stopRecording = useCallback(() => {
    if (recorderRef.current && state === "recording") {
      setState("stopping");
      recorderRef.current.stop();
    }
  }, [state]);

  return {
    state,
    isRecording: state === "recording",
    startRecording,
    stopRecording,
  };
}
