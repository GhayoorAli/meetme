import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Accepts a meeting code or a full join URL and returns the code only.
 * Examples:
 * - "8k7-6erk-oic"
 * - "http://localhost:3000/m/8k7-6erk-oic"
 * - "localhost:3000/m/8k7-6erk-oic"
 */
export function formatMeetingCode(input: string): string {
  const raw = input.trim();
  if (!raw) return "";

  const fromPath = raw.match(/\/m\/([a-z0-9-]+)/i);
  if (fromPath?.[1]) {
    return fromPath[1].toLowerCase();
  }

  const cleaned = raw
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\s+/g, "");

  const codeOnly = cleaned.match(/^([a-z0-9]+(?:-[a-z0-9]+)+)$/);
  if (codeOnly?.[1]) {
    return codeOnly[1];
  }

  return cleaned.replace(/[^a-z0-9-]/g, "");
}

export function copyToClipboard(text: string): Promise<void> {
  return navigator.clipboard.writeText(text);
}
