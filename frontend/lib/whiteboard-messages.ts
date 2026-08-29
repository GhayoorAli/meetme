export const WHITEBOARD_TOPIC = "meetme-whiteboard";

export type WhiteboardTool =
  | "pen"
  | "highlighter"
  | "eraser"
  | "line"
  | "rectangle"
  | "circle";

export type WhiteboardStroke = {
  id: string;
  tool: WhiteboardTool;
  color: string;
  width: number;
  points: [number, number][];
  author: string;
  authorIdentity: string;
};

export type WhiteboardOwner = {
  identity: string;
  name: string;
};

export type WhiteboardMessage =
  | { type: "stroke"; stroke: WhiteboardStroke }
  | { type: "undo"; strokeId: string; authorIdentity: string }
  | { type: "clear_own"; authorIdentity: string }
  | { type: "claim_owner"; owner: WhiteboardOwner }
  | { type: "handover"; owner: WhiteboardOwner }
  | { type: "revoke_editor" }
  | { type: "sync_request" }
  | {
      type: "sync_full";
      strokes: WhiteboardStroke[];
      owner: WhiteboardOwner | null;
    };

export function encodeWhiteboardMessage(message: WhiteboardMessage): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(message));
}

export function decodeWhiteboardMessage(payload: Uint8Array): WhiteboardMessage {
  return JSON.parse(new TextDecoder().decode(payload)) as WhiteboardMessage;
}

export async function publishWhiteboardMessage(
  room: import("livekit-client").Room,
  message: WhiteboardMessage,
): Promise<void> {
  const data = encodeWhiteboardMessage(message);
  await room.localParticipant.publishData(data as Uint8Array<ArrayBuffer>, {
    reliable: true,
    topic: WHITEBOARD_TOPIC,
  });
}
