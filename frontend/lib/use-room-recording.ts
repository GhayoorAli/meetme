"use client";

import type { Room, RemoteParticipant, LocalParticipant } from "livekit-client";
import { useCallback, useRef, useState } from "react";

type RecordingState = "idle" | "recording" | "stopping";

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
  canvas.width = 1280;
  canvas.height = 720;
  const ctx = canvas.getContext("2d")!;

  const videoElements = videoTracks.map((track) => {
    const el = document.createElement("video");
    el.srcObject = new MediaStream([track]);
    el.muted = true;
    el.playsInline = true;
    el.play().catch(() => {});
    return el;
  });

  let animationId = 0;
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

    animationId = requestAnimationFrame(drawFrame);
  };

  drawFrame();

  const canvasStream = canvas.captureStream(30);
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
    cancelAnimationFrame(animationId);
    videoElements.forEach((el) => {
      el.srcObject = null;
    });
    outputStream.getTracks().forEach((track) => track.stop());
    audioContext?.close();
  };

  return { stream: outputStream, cleanup };
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

    const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")
      ? "video/webm;codecs=vp9,opus"
      : "video/webm";

    const recorder = new MediaRecorder(stream, { mimeType });
    chunksRef.current = [];

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        chunksRef.current.push(event.data);
      }
    };

    recorder.onstop = () => {
      cleanupRef.current?.();
      cleanupRef.current = null;

      const blob = new Blob(chunksRef.current, { type: mimeType });
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
