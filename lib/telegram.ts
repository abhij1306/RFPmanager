/** Minimal Telegram Bot API client: only what the group brainstorm bot needs. */

export type TelegramUser = {
  id: number;
  is_bot: boolean;
  first_name: string;
  last_name?: string;
  username?: string;
};

export type TelegramMessageEntity = {
  type: string;
  offset: number;
  length: number;
};

export type TelegramMessage = {
  message_id: number;
  from?: TelegramUser;
  chat: {
    id: number;
    type: "private" | "group" | "supergroup" | "channel";
    title?: string;
  };
  text?: string;
  caption?: string;
  entities?: TelegramMessageEntity[];
  caption_entities?: TelegramMessageEntity[];
  reply_to_message?: TelegramMessage;
};

export type TelegramUpdate = {
  update_id: number;
  message?: TelegramMessage;
};

function getBotToken(): string {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    throw new Error("Missing TELEGRAM_BOT_TOKEN environment variable.");
  }
  return token;
}

async function callTelegram<T>(method: string, payload: Record<string, unknown>): Promise<T> {
  const response = await fetch(`https://api.telegram.org/bot${getBotToken()}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });

  const body = (await response.json()) as { ok: boolean; result?: T; description?: string };

  if (!response.ok || !body.ok) {
    throw new Error(`Telegram ${method} failed: ${body.description ?? response.statusText}`);
  }

  return body.result as T;
}

let cachedBotUser: Promise<TelegramUser> | null = null;

/** Identity of this bot, cached for the lifetime of the (warm) function instance. */
export function getBotUser(): Promise<TelegramUser> {
  cachedBotUser ??= callTelegram<TelegramUser>("getMe", {});
  return cachedBotUser;
}

export function sendChatTyping(chatId: number): Promise<true> {
  return callTelegram<true>("sendChatAction", { chat_id: chatId, action: "typing" });
}

/** Telegram hard-caps messages at 4096 characters; send long answers in order. */
export async function sendTelegramMessage(chatId: number, replyToMessageId: number, text: string): Promise<void> {
  for (const chunk of splitTelegramMessage(text)) {
    await callTelegram("sendMessage", {
      chat_id: chatId,
      text: chunk,
      reply_parameters: { message_id: replyToMessageId, allow_sending_without_reply: true },
    });
  }
}

/** Split on paragraph/line/word boundaries so long answers stay under the 4096 character cap. */
export function splitTelegramMessage(text: string, limit = 4000): string[] {
  const trimmed = text.trim();
  if (!trimmed) return ["(no answer)"];

  const chunks: string[] = [];
  let rest = trimmed;

  while (rest.length > limit) {
    let cut = rest.lastIndexOf("\n\n", limit);
    if (cut < limit / 2) cut = rest.lastIndexOf("\n", limit);
    if (cut < limit / 2) cut = rest.lastIndexOf(" ", limit);
    if (cut < 1) cut = limit;

    chunks.push(rest.slice(0, cut).trimEnd());
    rest = rest.slice(cut).trimStart();
  }

  if (rest) chunks.push(rest);
  return chunks;
}
