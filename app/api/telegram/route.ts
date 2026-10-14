import { after, NextResponse } from "next/server";
import { handleTelegramCallback, handleTelegramMessage } from "@/lib/telegram-bot";
import type { TelegramUpdate } from "@/lib/telegram";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Vercel's ceiling with Fluid Compute on every plan; the answer budget leaves time to send a reply before it.
export const maxDuration = 300;
const ANSWER_BUDGET_MS = 260_000;

/** Telegram retries until it sees a 200, so always ack - even for updates we ignore. */
export async function POST(request: Request) {
  // Fail closed: without a secret anyone could post forged updates and read tender data.
  const expectedSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!expectedSecret) {
    console.error("Telegram webhook rejected: TELEGRAM_WEBHOOK_SECRET is not set.");
    return NextResponse.json({ error: "Missing TELEGRAM_WEBHOOK_SECRET environment variable." }, { status: 500 });
  }
  if (request.headers.get("x-telegram-bot-api-secret-token") !== expectedSecret) {
    return NextResponse.json({ error: "Invalid webhook secret." }, { status: 403 });
  }

  let update: TelegramUpdate;
  try {
    update = (await request.json()) as TelegramUpdate;
  } catch {
    return NextResponse.json({ ok: true });
  }

  const logFailure = (error: unknown) => console.error("Telegram bot failed to handle update:", update.update_id, error);
  // Button taps need the webhook's allowed_updates to include "callback_query".
  const { message, callback_query: callbackQuery } = update;
  if (message) {
    after(() => handleTelegramMessage(message, { deadlineMs: ANSWER_BUDGET_MS }).catch(logFailure));
  } else if (callbackQuery) {
    after(() => handleTelegramCallback(callbackQuery, { deadlineMs: ANSWER_BUDGET_MS }).catch(logFailure));
  }

  return NextResponse.json({ ok: true });
}
