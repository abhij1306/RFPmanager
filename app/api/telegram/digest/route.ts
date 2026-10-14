import { NextResponse } from "next/server";
import { listRfpDigest } from "@/lib/rfp-queries";
import { sendText } from "@/lib/telegram";
import { parseAllowedChatIds } from "@/lib/telegram-bot";
import { buildDigest, sydneyNow } from "@/lib/telegram-digest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Weekly "closing soon" digest, called by the Vercel cron in vercel.json. Vercel sends
 * `Authorization: Bearer $CRON_SECRET`; without CRON_SECRET set, every call is refused.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("Telegram digest refused: CRON_SECRET is not set.");
    return NextResponse.json({ error: "Missing CRON_SECRET environment variable." }, { status: 500 });
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const text = buildDigest(await listRfpDigest(), sydneyNow());
  // Groups only: the allowlist is meant for group IDs, and a digest shouldn't land in someone's DMs.
  const groupIds = [...parseAllowedChatIds(process.env.TELEGRAM_ALLOWED_CHAT_IDS)].filter((id) => id < 0);
  const results = await Promise.allSettled(groupIds.map((chatId) => sendText(chatId, null, { text, markdown: true })));

  const failed = results.filter((result) => result.status === "rejected");
  for (const failure of failed) console.error("Telegram digest failed for a chat:", failure.reason);

  return NextResponse.json({ sent: results.length - failed.length, failed: failed.length });
}
