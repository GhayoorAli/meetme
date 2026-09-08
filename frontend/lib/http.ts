import type { ApiError } from "@/types";

const API_URL = resolveApiUrl();
const API_TIMEOUT_MS = 20_000;

function resolveApiUrl(): string {
  const raw = process.env.NEXT_PUBLIC_API_URL ?? "";
  if (raw === "same-origin" || raw === "/") return "";
  return raw.replace(/\/$/, "");
}

async function fetchWithTimeout(url: string, options: RequestInit = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), API_TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error("The API took too long to respond. Is PostgreSQL running?");
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

async function readJson(response: Response): Promise<unknown> {
  return response.json().catch(() => ({}));
}

export async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set("Accept", "application/json");
  if (options.body && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetchWithTimeout(`${API_URL}${path}`, {
    ...options,
    headers,
    credentials: "include",
  });

  if (response.status === 204) {
    return undefined as T;
  }

  const data = await readJson(response);

  if (!response.ok) {
    const error = data as ApiError;
    const firstFieldError = error.errors
      ? Object.values(error.errors)[0]?.[0]
      : undefined;
    throw new Error(firstFieldError ?? error.message ?? "Something went wrong.");
  }

  return data as T;
}
