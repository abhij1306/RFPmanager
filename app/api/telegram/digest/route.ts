import { NextResponse } from "next/server";
import { chatgptAuthErrorResponse, validateBearerSecret } from "@/lib/chatgpt-auth";
import { listRfpDigest } from "@/lib/rfp-queries";
import { sendTelegramMessage } from "@/lib/telegram";
import { allowedGroupIds } from "@/lib/telegram-bot";
import { buildDigest, sydneyNow } from "@/lib/telegram-digest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Weekly "closing soon" digest, called by the Vercel cron in vercel.json. Vercel sends
 * `Authorization: Bearer $CRON_SECRET`; without CRON_SECRET set, every call is refused.
 */
export async function GET(request: Request) {
  const auth = validateBearerSecret(request, "CRON_SECRET", "cron secret");
  if (!auth.ok) {
    if (auth.status === 500) console.error("Telegram digest refused:", auth.error);
    return chatgptAuthErrorResponse(auth);
  }

  const text = buildDigest(await listRfpDigest(), sydneyNow());
  // Groups only: a digest shouldn't land in someone's DMs.
  const results = await Promise.allSettled(allowedGroupIds().map((chatId) => sendTelegramMessage(chatId, null, text)));

  const failed = results.filter((result) => result.status === "rejected");
  for (const failure of failed) console.error("Telegram digest failed for a chat:", failure.reason);

  return NextResponse.json({ sent: results.length - failed.length, failed: failed.length });
}
