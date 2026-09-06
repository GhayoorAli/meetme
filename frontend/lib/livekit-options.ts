import {
  VideoPresets,
  type RoomOptions,
  type VideoCaptureOptions,
} from "livekit-client";

/** Camera capture — 720p is enough for small/medium calls. */
export const HD_VIDEO_CAPTURE: VideoCaptureOptions = {
  resolution: VideoPresets.h720.resolution,
};

/**
 * Prefer stability over max quality.
 * Screen share used to publish 1080p on top of every camera — that
 * saturated upload and made live calls freeze / blur / lag.
 */
export const HD_ROOM_OPTIONS: RoomOptions = {
  // Let LiveKit lower tile quality when bandwidth/CPU is tight.
  adaptiveStream: true,
  // Don't encode layers nobody is subscribed to.
  dynacast: true,
  videoCaptureDefaults: HD_VIDEO_CAPTURE,
  publishDefaults: {
    videoCodec: "vp8",
    videoEncoding: VideoPresets.h720.encoding,
    videoSimulcastLayers: [VideoPresets.h180, VideoPresets.h360],
    // 720p @ ~15fps — sharp enough for slides, much cheaper than 1080p30.
    screenShareEncoding: {
      ...VideoPresets.h720.encoding,
      maxFramerate: 15,
      maxBitrate: 1_500_000,
    },
    screenShareSimulcastLayers: [VideoPresets.h360],
    // Prefer smooth A/V over perfect sharpness when the network dips.
    degradationPreference: "balanced",
    dtx: true,
    red: true,
  },
  audioCaptureDefaults: {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
  },
};
