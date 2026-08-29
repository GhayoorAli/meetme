export const SCREEN_SHARE_TOPIC = "meetme-screen-share";

export type ScreenShareMessage =
  | { type: "screen_share_approved"; identity: string; name: string }
  | { type: "screen_share_denied"; identity: string; name: string }
  | { type: "screen_share_started"; identity: string; name: string }
  | { type: "screen_share_stopped"; identity: string; name: string };

export function encodeScreenShareMessage(message: ScreenShareMessage): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(message));
}

export function decodeScreenShareMessage(payload: Uint8Array): ScreenShareMessage {
  return JSON.parse(new TextDecoder().decode(payload)) as ScreenShareMessage;
}

export async function publishScreenShareMessage(
  room: import("livekit-client").Room,
  message: ScreenShareMessage,
): Promise<void> {
  const data = encodeScreenShareMessage(message);
  await room.localParticipant.publishData(data as Uint8Array<ArrayBuffer>, {
    reliable: true,
    topic: SCREEN_SHARE_TOPIC,
  });
}
