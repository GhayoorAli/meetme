import {
  AudioPresets,
  LocalVideoTrack,
  Track,
  VideoPresets,
  VideoQuality,
  type LocalParticipant,
  type RoomOptions,
  type ScreenShareCaptureOptions,
  type TrackPublishOptions,
  type VideoCaptureOptions,
} from "livekit-client";

/** Camera stays modest so a screen share can share the encoder. */
export const HD_VIDEO_CAPTURE: VideoCaptureOptions = {
  resolution: VideoPresets.h540.resolution,
  frameRate: 20,
};

/**
 * Cap getDisplayMedia at capture time. Native 4K@30 plus camera encoding
 * freezes tiles and delays audio. Prefer max constraints so Chrome cannot
 * silently capture a 4K monitor.
 */
export const SCREEN_SHARE_CAPTURE: ScreenShareCaptureOptions = {
  audio: false,
  resolution: {
    width: 1280,
    height: 720,
    frameRate: 10,
  },
  contentHint: "detail",
  selfBrowserSurface: "exclude",
};

export const SCREEN_SHARE_PUBLISH: TrackPublishOptions = {
  simulcast: false,
  degradationPreference: "balanced",
  screenShareEncoding: {
    maxBitrate: 700_000,
    maxFramerate: 10,
    priority: "low",
  },
};

export const HD_ROOM_OPTIONS: RoomOptions = {
  adaptiveStream: true,
  dynacast: true,
  videoCaptureDefaults: HD_VIDEO_CAPTURE,
  publishDefaults: {
    videoCodec: "vp8",
    audioPreset: AudioPresets.speech,
    videoEncoding: VideoPresets.h540.encoding,
    videoSimulcastLayers: [VideoPresets.h180],
    screenShareEncoding: SCREEN_SHARE_PUBLISH.screenShareEncoding,
    dtx: true,
    red: true,
  },
  audioCaptureDefaults: {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
  },
};

type MeetingLoadListener = (heavy: boolean) => void;

const loadListeners = new Set<MeetingLoadListener>();
let localSharing = false;
let localRecording = false;

export function isMeetingEncoderHeavy() {
  return localSharing || localRecording;
}

export function subscribeMeetingEncoderLoad(listener: MeetingLoadListener) {
  loadListeners.add(listener);
  listener(isMeetingEncoderHeavy());
  return () => {
    loadListeners.delete(listener);
  };
}

function emitMeetingLoad() {
  const heavy = isMeetingEncoderHeavy();
  for (const listener of loadListeners) listener(heavy);
}

function applyCameraBudget(participant: LocalParticipant, lite: boolean) {
  const publication = participant.getTrackPublication(Track.Source.Camera);
  const track = publication?.videoTrack;
  if (!(track instanceof LocalVideoTrack)) return;

  if (lite) {
    void track.prioritizePerformance();
    track.setPublishingQuality(VideoQuality.LOW);
    return;
  }

  track.setPublishingQuality(VideoQuality.HIGH);
}

/** Drop camera layers while the local participant is sharing a screen. */
export function setCameraPublishBudget(
  participant: LocalParticipant,
  lite: boolean,
) {
  applyCameraBudget(participant, lite);
}

export async function capScreenShareTrack(participant: LocalParticipant) {
  const publication = participant.getTrackPublication(Track.Source.ScreenShare);
  const mediaTrack = publication?.track?.mediaStreamTrack;
  if (!mediaTrack || mediaTrack.readyState !== "live") return;

  try {
    await mediaTrack.applyConstraints({
      width: { max: 1280, ideal: 1280 },
      height: { max: 720, ideal: 720 },
      frameRate: { max: 10, ideal: 8 },
    });
  } catch {
    // Some browsers reject mixed width/height/frameRate constraints.
  }

  try {
    if ("contentHint" in mediaTrack) {
      mediaTrack.contentHint = "detail";
    }
  } catch {
    // ignore
  }
}

export function setLocalScreenShareLoad(
  participant: LocalParticipant,
  enabled: boolean,
) {
  localSharing = enabled;
  applyCameraBudget(participant, localSharing || localRecording);
  if (enabled) {
    void capScreenShareTrack(participant);
  }
  emitMeetingLoad();
}

export function setLocalRecordingLoad(
  participant: LocalParticipant,
  enabled: boolean,
) {
  localRecording = enabled;
  applyCameraBudget(participant, localSharing || localRecording);
  emitMeetingLoad();
}
