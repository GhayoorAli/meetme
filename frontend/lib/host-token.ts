const PREFIX = "meetme_host_";
const NAME_PREFIX = "meetme_guest_name_";

export function saveHostToken(meetingCode: string, token: string) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(`${PREFIX}${meetingCode}`, token);
}

export function saveGuestHostName(meetingCode: string, name: string) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(`${NAME_PREFIX}${meetingCode}`, name);
}

export function getGuestHostName(meetingCode: string): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(`${NAME_PREFIX}${meetingCode}`);
}

export function getHostToken(meetingCode: string): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(`${PREFIX}${meetingCode}`);
}

export function clearHostToken(meetingCode: string) {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(`${PREFIX}${meetingCode}`);
  sessionStorage.removeItem(`${NAME_PREFIX}${meetingCode}`);
}

export function hostAuthBody(meetingCode: string): Record<string, string> {
  const host_token = getHostToken(meetingCode);
  return host_token ? { host_token } : {};
}
