import { daysUntil, formatDateOnly } from "@/lib/date";

/** Portal-scraped names often carry the issuer and a page suffix; show only the tender name. */
export function displayTitle(clientName: string): string {
  const [title] = clientName.split(/\s+-\s+Issued by\s+/i);
  return title.replace(/\s*\|\s*Opportunity Details\s*$/i, "").trim() || clientName;
}

export type ClosingInfo =
  | { kind: "none" }
  | { kind: "text"; label: string }
  | { kind: "date"; label: string; relative: string; urgency: "past" | "soon" | "later" };

export function closingInfo(closingDate: string | null, closingDateText?: string | null, now = new Date()): ClosingInfo {
  const days = daysUntil(closingDate, now);
  if (closingDate && days !== null) {
    const label = formatDateOnly(closingDate);
    if (days < 0) return { kind: "date", label, relative: "Closed", urgency: "past" };
    if (days === 0) return { kind: "date", label, relative: "Closes today", urgency: "soon" };
    if (days === 1) return { kind: "date", label, relative: "Tomorrow", urgency: "soon" };
    return { kind: "date", label, relative: `In ${days} days`, urgency: days <= 7 ? "soon" : "later" };
  }
  if (closingDateText) return { kind: "text", label: closingDateText };
  return { kind: "none" };
}

/** Cut to `limit` characters, marking the cut with "...". */
export function truncate(value: string, limit: number): string {
  return value.length > limit ? `${value.slice(0, limit)}...` : value;
}

export function formatBytes(bytes: number | null | undefined): string | null {
  if (!bytes || bytes <= 0) return null;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

const relativeFormatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
const shortDateFormatter = new Intl.DateTimeFormat("en", { day: "numeric", month: "short", year: "numeric" });

export function formatRelativeTime(value: string, now = new Date()): string {
  const date = new Date(value);
  const seconds = Math.round((date.getTime() - now.getTime()) / 1000);
  const abs = Math.abs(seconds);
  if (abs < 60) return "Just now";
  if (abs < 3600) return relativeFormatter.format(Math.round(seconds / 60), "minute");
  if (abs < 86_400) return relativeFormatter.format(Math.round(seconds / 3600), "hour");
  if (abs < 86_400 * 7) return relativeFormatter.format(Math.round(seconds / 86_400), "day");
  return shortDateFormatter.format(date);
}

export function formatTimestamp(value: string): string {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export function fileExtension(filename: string | null | undefined): string {
  const extension = filename?.split(".").pop();
  return extension && extension !== filename ? extension.toUpperCase() : "FILE";
}
