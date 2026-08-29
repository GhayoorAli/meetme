const PREFIX = "meetme_admit_";

export function saveAdmitToken(meetingCode: string, token: string) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(`${PREFIX}${meetingCode}`, token);
}

export function getAdmitToken(meetingCode: string): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(`${PREFIX}${meetingCode}`);
}

export function clearAdmitToken(meetingCode: string) {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(`${PREFIX}${meetingCode}`);
}
