import { rfpPageUrl } from "@/lib/app-url";
import { daysUntil } from "@/lib/date";
import { closingInfo, displayTitle } from "@/lib/display";
import type { RfpDigestItem } from "@/lib/rfp-queries";

/**
 * The "closing soon" digest: posted to the team's groups every Monday morning by the cron job, and on demand
 * with /digest. Built straight from the database - no model call, so it is quick, cheap and always the same.
 */

export const DIGEST_DAYS = 14;

/** Wall-clock time in Sydney, so "days left" counts from the team's today, not the server's UTC date. */
export function sydneyNow(now = new Date()): Date {
  return new Date(now.toLocaleString("en-US", { timeZone: "Australia/Sydney" }));
}

export function buildDigest(
  rfps: RfpDigestItem[],
  now: Date,
  pageUrl: (rfpId: string) => string | null = rfpPageUrl,
): string {
  const upcoming = rfps
    .map((rfp) => ({ rfp, days: daysUntil(rfp.closing_date, now) }))
    .filter((item): item is { rfp: RfpDigestItem; days: number } => item.days !== null && item.days >= 0 && item.days <= DIGEST_DAYS)
    .sort((a, b) => a.days - b.days);

  if (upcoming.length === 0) return `📅 **No tenders close in the next ${DIGEST_DAYS} days.**`;

  const lines = upcoming.map(({ rfp }) => {
    const name = `**${displayTitle(rfp.client_name)}**`;
    const url = pageUrl(rfp.id);
    // Same wording as the closing column in the web app ("Tomorrow", "In 11 days").
    const closing = closingInfo(rfp.closing_date, null, now);
    const when = closing.kind === "date" ? `${closing.relative} (${closing.label})` : "";
    const details = [when, `bid: ${rfp.status}`, rfp.pipeline_stage].filter(Boolean).join(" · ");
    return `- ${url ? `[${name}](${url})` : name} - ${details}`;
  });

  return [`📅 **Tenders closing in the next ${DIGEST_DAYS} days**`, "", ...lines].join("\n");
}
