import { API_URL } from "@/lib/config";
import {
  getAdmitToken,
  getHostToken,
  getToken,
  setAdmitToken,
  setHostToken,
} from "@/lib/storage";
import type { JoinMeetingResponse, Meeting, MeetingParticipant, User } from "@/lib/types";

class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set("Accept", "application/json");
  if (options.body) headers.set("Content-Type", "application/json");
  const token = await getToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const response = await fetch(`${API_URL}${path}`, { ...options, headers });
  const data = (await response.json().catch(() => ({}))) as {
    message?: string;
    errors?: Record<string, string[]>;
  };

  if (!response.ok) {
    const firstFieldError = data.errors ? Object.values(data.errors)[0]?.[0] : undefined;
    throw new ApiError(firstFieldError ?? data.message ?? "Something went wrong.", response.status);
  }
  return data as T;
}

export const api = {
  async login(email: string, password: string) {
    return request<{ data: User; token: string }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
  },

  async loginWithGoogle(idToken: string) {
    return request<{ data: User; token: string }>("/api/auth/google", {
      method: "POST",
      body: JSON.stringify({ id_token: idToken }),
    });
  },

  async register(name: string, email: string, password: string, passwordConfirmation: string) {
    return request<{ data: User; token: string }>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({
        name,
        email,
        password,
        password_confirmation: passwordConfirmation,
      }),
    });
  },

  async getUser() {
    const response = await request<{ data: User }>("/api/user");
    return response.data;
  },

  async getMeetings() {
    const response = await request<{ data: Meeting[] }>("/api/meetings");
    return response.data;
  },

  async createMeeting() {
    const response = await request<{ data: Meeting }>("/api/meetings", {
      method: "POST",
      body: JSON.stringify({}),
    });
    return response.data;
  },

  async getMeeting(code: string) {
    const response = await request<{ data: Meeting }>(`/api/meetings/${code}`);
    return response.data;
  },

  async joinMeeting(code: string, displayName?: string) {
    const body: Record<string, string> = {};
    if (displayName) body.display_name = displayName;
    const hostToken = await getHostToken(code);
    if (hostToken) body.host_token = hostToken;
    const admitToken = await getAdmitToken(code);
    if (admitToken) body.admit_token = admitToken;

    const result = await request<JoinMeetingResponse>(`/api/meetings/${code}/join`, {
      method: "POST",
      body: JSON.stringify(body),
    });
    if (result.participant.admit_token) {
      await setAdmitToken(code, result.participant.admit_token);
    }
    if (result.host_token) {
      await setHostToken(code, result.host_token);
    }
    return result;
  },

  async getJoinStatus(code: string, admitToken: string) {
    return request<JoinMeetingResponse>(
      `/api/meetings/${code}/join-status?admit_token=${encodeURIComponent(admitToken)}`,
    );
  },

  async getWaiting(code: string) {
    const hostToken = await getHostToken(code);
    const suffix = hostToken ? `?host_token=${encodeURIComponent(hostToken)}` : "";
    const response = await request<{ data: MeetingParticipant[] }>(
      `/api/meetings/${code}/waiting${suffix}`,
    );
    return response.data;
  },

  async admit(code: string, participantId: number) {
    const hostToken = await getHostToken(code);
    return request<{ message: string }>(`/api/meetings/${code}/participants/${participantId}/admit`, {
      method: "POST",
      body: JSON.stringify(hostToken ? { host_token: hostToken } : {}),
    });
  },

  async deny(code: string, participantId: number) {
    const hostToken = await getHostToken(code);
    return request<{ message: string }>(`/api/meetings/${code}/participants/${participantId}/deny`, {
      method: "POST",
      body: JSON.stringify(hostToken ? { host_token: hostToken } : {}),
    });
  },

  async leave(code: string, data: { admit_token?: string; identity?: string }) {
    return request<{ message: string }>(`/api/meetings/${code}/leave`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  async end(code: string) {
    const hostToken = await getHostToken(code);
    return request<{ message: string }>(`/api/meetings/${code}/end`, {
      method: "POST",
      body: JSON.stringify(hostToken ? { host_token: hostToken } : {}),
    });
  },
};
