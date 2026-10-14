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
  /** UTF-16 code units, so it indexes JS strings directly. */
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

  // Gateway errors come back as HTML, so don't let a parse failure hide the real status.
  const body = (await response.json().catch(() => ({ ok: false }))) as { ok: boolean; result?: T; description?: string };

  if (!response.ok || !body.ok) {
    throw new Error(`Telegram ${method} failed (${response.status}): ${body.description ?? response.statusText}`);
  }

  return body.result as T;
}

let cachedBotUser: Promise<TelegramUser> | null = null;

/** Identity of this bot, cached for the lifetime of the (warm) function instance. Failures are not cached. */
export function getBotUser(): Promise<TelegramUser> {
  if (!cachedBotUser) {
    const pending = callTelegram<TelegramUser>("getMe", {});
    cachedBotUser = pending;
    pending.catch(() => {
      if (cachedBotUser === pending) cachedBotUser = null;
    });
  }
  return cachedBotUser;
}

type ChatMember = { status: "creator" | "administrator" | "member" | "restricted" | "left" | "kicked"; is_member?: boolean };

/** True when the user currently belongs to the chat (restricted members count only while still in it). */
export async function isChatMember(chatId: number, userId: number): Promise<boolean> {
  const member = await callTelegram<ChatMember>("getChatMember", { chat_id: chatId, user_id: userId });
  if (member.status === "restricted") return member.is_member === true;
  return member.status === "creator" || member.status === "administrator" || member.status === "member";
}

export function sendChatTyping(chatId: number): Promise<true> {
  return callTelegram<true>("sendChatAction", { chat_id: chatId, action: "typing" });
}

/** Telegram hard-caps messages at 4096 characters; send long answers in order. Resolves to the sent message ids. */
export async function sendTelegramMessage(chatId: number, replyToMessageId: number, text: string): Promise<number[]> {
  const sentIds: number[] = [];
  for (const chunk of splitTelegramMessage(text)) {
    const sent = await callTelegram<{ message_id: number }>("sendMessage", {
      chat_id: chatId,
      text: chunk,
      reply_parameters: { message_id: replyToMessageId, allow_sending_without_reply: true },
    });
    sentIds.push(sent.message_id);
  }
  return sentIds;
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
