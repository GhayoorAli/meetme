import { randomBytes, randomUUID } from "node:crypto";

const LETTERS = "abcdefghijklmnopqrstuvwxyz";

function randomLetters(length: number) {
  let out = "";
  const bytes = randomBytes(length);
  for (let i = 0; i < length; i += 1) {
    out += LETTERS[bytes[i]! % LETTERS.length];
  }
  return out;
}

export function generateMeetingCode() {
  return `${randomLetters(3)}-${randomLetters(4)}-${randomLetters(3)}`;
}

export function generateRoomName() {
  return `room_${randomUUID()}`;
}

export function randomToken(bytes = 24) {
  return randomBytes(bytes).toString("hex").slice(0, bytes * 2);
}
