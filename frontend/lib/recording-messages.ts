export const RECORDING_TOPIC = "meetme-recording";

export type RecordingMessage =
  | { type: "recording_started"; identity: string; name: string }
  | { type: "recording_stopped"; identity: string; name: string }
  | { type: "recording_approved"; identity: string; name: string }
  | { type: "recording_denied"; identity: string; name: string };

export function encodeRecordingMessage(message: RecordingMessage): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(message));
}

export function decodeRecordingMessage(payload: Uint8Array): RecordingMessage {
  const parsed = JSON.parse(new TextDecoder().decode(payload)) as RecordingMessage;
  if (!parsed?.type || !parsed.identity) {
    throw new Error("Invalid recording message");
  }
  return parsed;
}

export async function publishRecordingMessage(
  room: import("livekit-client").Room,
  message: RecordingMessage,
): Promise<void> {
  const data = encodeRecordingMessage(message);
  await room.localParticipant.publishData(data as Uint8Array<ArrayBuffer>, {
    reliable: true,
    topic: RECORDING_TOPIC,
  });
}
