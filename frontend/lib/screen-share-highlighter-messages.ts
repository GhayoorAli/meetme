export const SCREEN_SHARE_HIGHLIGHTER_TOPIC = "meetme-screen-share-highlighter";

export type HighlightStroke = {
  id: string;
  color: string;
  /** Line width as a fraction of the shared video height (0–1 scale). */
  widthNorm: number;
  /** Normalized positions on the shared screen (0–1). */
  points: [number, number][];
  author: string;
  authorIdentity: string;
};

export type ScreenShareHighlighterMessage =
  | { type: "highlight_stroke"; stroke: HighlightStroke }
  | { type: "highlight_undo"; strokeId: string }
  | { type: "highlight_clear" }
  | { type: "sync_request" }
  | { type: "sync_full"; strokes: HighlightStroke[] };

export function encodeScreenShareHighlighterMessage(
  message: ScreenShareHighlighterMessage,
): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(message));
}

export function decodeScreenShareHighlighterMessage(
  payload: Uint8Array,
): ScreenShareHighlighterMessage {
  return JSON.parse(
    new TextDecoder().decode(payload),
  ) as ScreenShareHighlighterMessage;
}

export async function publishScreenShareHighlighterMessage(
  room: import("livekit-client").Room,
  message: ScreenShareHighlighterMessage,
): Promise<void> {
  const data = encodeScreenShareHighlighterMessage(message);
  await room.localParticipant.publishData(data as Uint8Array<ArrayBuffer>, {
    reliable: true,
    topic: SCREEN_SHARE_HIGHLIGHTER_TOPIC,
  });
}
