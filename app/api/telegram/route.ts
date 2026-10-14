import { after, NextResponse } from "next/server";
import { answerQuestion, engagementFor } from "@/lib/telegram-bot";
import { getBotUser, sendChatTyping, sendTelegramMessage, type TelegramUpdate } from "@/lib/telegram";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** Telegram retries until it sees a 200, so always ack - even for updates we ignore. */
export async function POST(request: Request) {
  const expectedSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (expectedSecret && request.headers.get("x-telegram-bot-api-secret-token") !== expectedSecret) {
    return NextResponse.json({ error: "Invalid webhook secret." }, { status: 403 });
  }

  let update: TelegramUpdate;
  try {
    update = (await request.json()) as TelegramUpdate;
  } catch {
    return NextResponse.json({ ok: true });
  }

  const message = update.message;
  if (!message) {
    return NextResponse.json({ ok: true });
  }

  after(async () => {
    try {
      const botUser = await getBotUser();
      const engagement = engagementFor(message, { id: botUser.id, username: botUser.username ?? "" });
      if (!engagement.respond) return;

      await sendChatTyping(message.chat.id).catch(() => undefined);
      const answer = await answerQuestion(message, engagement.question);
      await sendTelegramMessage(message.chat.id, message.message_id, answer);
    } catch (error) {
      console.error("Telegram bot failed to answer:", error);
      await sendTelegramMessage(
        message.chat.id,
        message.message_id,
        "Sorry, something went wrong on my side. Please try again in a moment.",
      ).catch(() => undefined);
    }
  });

  return NextResponse.json({ ok: true });
}
