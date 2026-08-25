import {
  VideoPresets,
  type RoomOptions,
  type VideoCaptureOptions,
} from "livekit-client";

/** Capture and publish at 720p HD for all participants. */
export const HD_VIDEO_CAPTURE: VideoCaptureOptions = {
  resolution: VideoPresets.h720.resolution,
};

/**
 * Room options tuned for small/medium group calls where we prefer
 * consistent HD over aggressive bandwidth saving.
 */
export const HD_ROOM_OPTIONS: RoomOptions = {
  // Keep subscribed quality high even when tiles are smaller in the grid.
  adaptiveStream: false,
  // Still avoid encoding unused layers when nobody is watching them.
  dynacast: true,
  videoCaptureDefaults: HD_VIDEO_CAPTURE,
  publishDefaults: {
    videoCodec: "vp8",
    videoEncoding: VideoPresets.h720.encoding,
    // Lower layers remain available if a client truly cannot take HD.
    videoSimulcastLayers: [VideoPresets.h180, VideoPresets.h360],
    screenShareEncoding: VideoPresets.h1080.encoding,
    degradationPreference: "maintain-resolution",
    dtx: true,
    red: true,
  },
  audioCaptureDefaults: {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
  },
};
