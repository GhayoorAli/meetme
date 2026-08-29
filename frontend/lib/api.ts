import type { ApiError } from "@/types";
import { getAdmitToken } from "@/lib/admit-token";
import { getHostToken, hostAuthBody } from "@/lib/host-token";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const API_TIMEOUT_MS = 15_000;

async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), API_TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error(
        `Cannot reach the API at ${API_URL}. Start the backend with "php artisan serve" in the backend folder, and run "docker compose up -d mysql" for the database.`,
      );
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

async function ensureCsrfCookie(): Promise<void> {
  await fetchWithTimeout(`${API_URL}/sanctum/csrf-cookie`, {
    credentials: "include",
  });
}

function getCsrfToken(): string | null {
  return getCookie("XSRF-TOKEN");
}

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const method = (options.method ?? "GET").toUpperCase();
  if (method !== "GET" && method !== "HEAD") {
    await ensureCsrfCookie();
  }

  const headers = new Headers(options.headers);
  headers.set("Accept", "application/json");
  headers.set("X-Requested-With", "XMLHttpRequest");

  if (options.body && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  const csrf = getCsrfToken();
  if (csrf) {
    headers.set("X-XSRF-TOKEN", csrf);
  } else if (method !== "GET" && method !== "HEAD") {
    throw new Error(
      "CSRF cookie missing. Open the app at http://localhost:3000 (not 127.0.0.1) and ensure the backend runs on http://localhost:8000.",
    );
  }

  const response = await fetchWithTimeout(`${API_URL}${path}`, {
    ...options,
    headers,
    credentials: "include",
  });

  if (response.status === 204) {
    return undefined as T;
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = data as ApiError;
    const firstFieldError = error.errors
      ? Object.values(error.errors)[0]?.[0]
      : undefined;
    throw new Error(firstFieldError ?? error.message ?? "Something went wrong.");
  }

  return data as T;
}

export const api = {
  async initCsrf(): Promise<void> {
    await ensureCsrfCookie();
  },

  async getUser() {
    const response = await request<{ data: import("@/types").User }>("/api/user");
    return response.data;
  },

  async login(email: string, password: string) {
    await ensureCsrfCookie();
    await request<void>("/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    await ensureCsrfCookie();
  },

  async register(name: string, email: string, password: string, password_confirmation: string) {
    await ensureCsrfCookie();
    await request<void>("/register", {
      method: "POST",
      body: JSON.stringify({ name, email, password, password_confirmation }),
    });
    await ensureCsrfCookie();
  },

  async logout() {
    return request<void>("/logout", { method: "POST" });
  },

  async getMeetings() {
    const response = await request<{ data: import("@/types").Meeting[] }>("/api/meetings");
    return response.data;
  },

  async createMeeting(title?: string) {
    const response = await request<{ data: import("@/types").Meeting }>("/api/meetings", {
      method: "POST",
      body: JSON.stringify({ title }),
    });
    return response.data;
  },

  async createGuestMeeting(displayName: string, title?: string) {
    return request<{
      meeting: import("@/types").Meeting;
      host_token: string;
    }>("/api/meetings/guest", {
      method: "POST",
      body: JSON.stringify({ display_name: displayName, title }),
    });
  },

  async getMeeting(code: string) {
    const response = await request<{ data: import("@/types").Meeting }>(`/api/meetings/${code}`);
    return response.data;
  },

  async joinMeeting(
    code: string,
    options?: { displayName?: string; hostToken?: string; admitToken?: string },
  ) {
    const body: Record<string, string> = {};
    if (options?.displayName) body.display_name = options.displayName;
    const hostToken = options?.hostToken ?? getHostToken(code);
    if (hostToken) body.host_token = hostToken;
    const admitToken = options?.admitToken ?? getAdmitToken(code);
    if (admitToken) body.admit_token = admitToken;

    return request<import("@/types").JoinMeetingResponse>(
      `/api/meetings/${code}/join`,
      {
        method: "POST",
        body: JSON.stringify(body),
      },
    );
  },

  async getJoinStatus(code: string, admitToken: string) {
    return request<import("@/types").JoinMeetingResponse>(
      `/api/meetings/${code}/join-status?admit_token=${encodeURIComponent(admitToken)}`,
    );
  },

  async getWaitingParticipants(code: string) {
    const auth = hostAuthBody(code);
    const suffix = auth.host_token
      ? `?host_token=${encodeURIComponent(auth.host_token)}`
      : "";
    const response = await request<{
      data: import("@/types").MeetingParticipant[];
    }>(`/api/meetings/${code}/waiting${suffix}`);
    return response.data;
  },

  async admitParticipant(code: string, participantId: number) {
    return request<{ message: string }>(
      `/api/meetings/${code}/participants/${participantId}/admit`,
      { method: "POST", body: JSON.stringify(hostAuthBody(code)) },
    );
  },

  async denyParticipant(code: string, participantId: number) {
    return request<{ message: string }>(
      `/api/meetings/${code}/participants/${participantId}/deny`,
      { method: "POST", body: JSON.stringify(hostAuthBody(code)) },
    );
  },

  async leaveMeeting(code: string, data: { admit_token?: string; identity?: string }) {
    return request<{ message: string }>(`/api/meetings/${code}/leave`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  async endMeeting(code: string) {
    return request<{ message: string }>(`/api/meetings/${code}/end`, {
      method: "POST",
      body: JSON.stringify(hostAuthBody(code)),
    });
  },

  async requestRecording(
    code: string,
    data: { admit_token?: string; identity?: string },
  ) {
    return request<{
      message: string;
      recording_permission: import("@/types").RecordingPermissionStatus;
    }>(`/api/meetings/${code}/recording/request`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  async getRecordingStatus(
    code: string,
    params: { admit_token?: string; identity?: string },
  ) {
    const query = new URLSearchParams();
    if (params.admit_token) query.set("admit_token", params.admit_token);
    if (params.identity) query.set("identity", params.identity);
    const suffix = query.toString() ? `?${query.toString()}` : "";

    return request<{
      recording_permission: import("@/types").RecordingPermissionStatus;
      can_record: boolean;
    }>(`/api/meetings/${code}/recording/status${suffix}`);
  },

  async getRecordingRequests(code: string) {
    const auth = hostAuthBody(code);
    const suffix = auth.host_token
      ? `?host_token=${encodeURIComponent(auth.host_token)}`
      : "";
    const response = await request<{
      data: import("@/types").MeetingParticipant[];
    }>(`/api/meetings/${code}/recording/requests${suffix}`);
    return response.data;
  },

  async approveRecording(code: string, participantId: number) {
    return request<{ message: string }>(
      `/api/meetings/${code}/recording/participants/${participantId}/approve`,
      { method: "POST", body: JSON.stringify(hostAuthBody(code)) },
    );
  },

  async denyRecording(code: string, participantId: number) {
    return request<{ message: string }>(
      `/api/meetings/${code}/recording/participants/${participantId}/deny`,
      { method: "POST", body: JSON.stringify(hostAuthBody(code)) },
    );
  },

  async requestScreenShare(
    code: string,
    data: { admit_token?: string; identity?: string },
  ) {
    return request<{
      message: string;
      screen_share_permission: import("@/types").ScreenSharePermissionStatus;
    }>(`/api/meetings/${code}/screen-share/request`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  async getScreenShareStatus(
    code: string,
    params: { admit_token?: string; identity?: string },
  ) {
    const query = new URLSearchParams();
    if (params.admit_token) query.set("admit_token", params.admit_token);
    if (params.identity) query.set("identity", params.identity);
    const suffix = query.toString() ? `?${query.toString()}` : "";
    return request<{
      screen_share_permission: import("@/types").ScreenSharePermissionStatus;
      can_share_screen: boolean;
    }>(`/api/meetings/${code}/screen-share/status${suffix}`);
  },

  async getScreenShareRequests(code: string) {
    const auth = hostAuthBody(code);
    const suffix = auth.host_token
      ? `?host_token=${encodeURIComponent(auth.host_token)}`
      : "";
    const response = await request<{
      data: import("@/types").MeetingParticipant[];
    }>(`/api/meetings/${code}/screen-share/requests${suffix}`);
    return response.data;
  },

  async approveScreenShare(code: string, participantId: number) {
    return request<{ message: string }>(
      `/api/meetings/${code}/screen-share/participants/${participantId}/approve`,
      { method: "POST", body: JSON.stringify(hostAuthBody(code)) },
    );
  },

  async denyScreenShare(code: string, participantId: number) {
    return request<{ message: string }>(
      `/api/meetings/${code}/screen-share/participants/${participantId}/deny`,
      { method: "POST", body: JSON.stringify(hostAuthBody(code)) },
    );
  },

  async getAdminStats() {
    return request<import("@/types").AdminStats>("/api/admin/stats");
  },

  async getAdminUsers(page = 1) {
    return request<import("@/types").PaginatedResponse<import("@/types").User>>(
      `/api/admin/users?page=${page}`,
    );
  },

  async getAdminMeetings(page = 1) {
    return request<import("@/types").PaginatedResponse<import("@/types").Meeting>>(
      `/api/admin/meetings?page=${page}`,
    );
  },

  async updateUser(id: number, data: { is_admin?: boolean; name?: string }) {
    return request<{ data: import("@/types").User }>(`/api/admin/users/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  },

  async deleteMeeting(id: number) {
    return request<{ message: string }>(`/api/admin/meetings/${id}`, {
      method: "DELETE",
    });
  },
};
