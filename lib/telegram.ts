/** Minimal Telegram Bot API client: only what the group brainstorm bot needs. */

import { memoizeAsync } from "@/lib/memoize-async";
import { markdownToTelegramHtml } from "@/lib/telegram-format";

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
  reply_markup?: { inline_keyboard: InlineKeyboard };
};

export type InlineButton = { text: string; url: string } | { text: string; callback_data: string };
export type InlineKeyboard = InlineButton[][];

/** A tap on an inline button. `message` is the bot message carrying the button (absent if it is too old). */
export type TelegramCallbackQuery = {
  id: string;
  from: TelegramUser;
  message?: TelegramMessage;
  data?: string;
};

export type TelegramUpdate = {
  update_id: number;
  message?: TelegramMessage;
  callback_query?: TelegramCallbackQuery;
};

export class TelegramApiError extends Error {
  constructor(
    readonly method: string,
    readonly status: number,
    readonly description: string,
  ) {
    super(`Telegram ${method} failed (${status}): ${description}`);
    this.name = "TelegramApiError";
  }
}

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
    throw new TelegramApiError(method, response.status, body.description ?? response.statusText);
  }

  return body.result as T;
}

/** Identity of this bot, cached for the lifetime of the (warm) function instance. Failures are not cached. */
export const getBotUser = memoizeAsync(() => callTelegram<TelegramUser>("getMe", {}));

/** "First Last", else the @username, else the fallback. */
export function displayName(user: TelegramUser | undefined, fallback: string): string {
  if (!user) return fallback;
  return [user.first_name, user.last_name].filter(Boolean).join(" ").trim() || user.username || fallback;
}

type ChatMember = { status: "creator" | "administrator" | "member" | "restricted" | "left" | "kicked"; is_member?: boolean };

/** True when the user currently belongs to the chat (restricted members count only while still in it). */
export async function isChatMember(chatId: number, userId: number): Promise<boolean> {
  const member = await callTelegram<ChatMember>("getChatMember", { chat_id: chatId, user_id: userId });
  if (member.status === "restricted") return member.is_member === true;
  return member.status === "creator" || member.status === "administrator" || member.status === "member";
}

/** One outgoing message body: plain text, or light Markdown sent as Telegram HTML. */
export type OutgoingText = { text: string; markdown?: boolean; buttons?: InlineKeyboard };

function textPayload({ text, markdown, buttons }: OutgoingText, { asHtml }: { asHtml: boolean }) {
  return {
    text: asHtml ? markdownToTelegramHtml(text) : text,
    ...(asHtml ? { parse_mode: "HTML" } : {}),
    ...(buttons ? { reply_markup: { inline_keyboard: buttons } } : {}),
    link_preview_options: { is_disabled: true },
  };
}

/** HTML that Telegram can't parse is resent as the plain source text rather than failing the message. */
async function withPlainFallback<T>(out: OutgoingText, send: (payload: ReturnType<typeof textPayload>) => Promise<T>): Promise<T> {
  if (!out.markdown) return send(textPayload(out, { asHtml: false }));
  try {
    return await send(textPayload(out, { asHtml: true }));
  } catch (error) {
    if (!(error instanceof TelegramApiError && error.status === 400 && /parse entities/i.test(error.description))) throw error;
    return send(textPayload(out, { asHtml: false }));
  }
}

/** Send one message (at most MESSAGE_CHUNK characters of source text), optionally as a reply. Resolves to its id. */
export async function sendText(chatId: number, replyToMessageId: number | null, out: OutgoingText): Promise<number> {
  const reply = replyToMessageId === null ? {} : { reply_parameters: { message_id: replyToMessageId, allow_sending_without_reply: true } };
  const sent = await withPlainFallback(out, (payload) =>
    callTelegram<{ message_id: number }>("sendMessage", { chat_id: chatId, ...payload, ...reply }),
  );
  return sent.message_id;
}

export async function editText(chatId: number, messageId: number, out: OutgoingText): Promise<void> {
  await withPlainFallback(out, (payload) => callTelegram("editMessageText", { chat_id: chatId, message_id: messageId, ...payload }));
}

export async function editButtons(chatId: number, messageId: number, buttons: InlineKeyboard): Promise<void> {
  await callTelegram("editMessageReplyMarkup", { chat_id: chatId, message_id: messageId, reply_markup: { inline_keyboard: buttons } });
}

/** Stops the button's loading spinner; `text` shows as a small toast. Must happen within ~15s of the tap. */
export async function answerCallbackQuery(callbackQueryId: string, text?: string): Promise<void> {
  await callTelegram("answerCallbackQuery", { callback_query_id: callbackQueryId, ...(text ? { text } : {}) });
}

/** Source characters per message: below Telegram's 4096 cap, leaving room for HTML escapes and tags. */
export const MESSAGE_CHUNK = 3500;

/** Send a long text in order as replies. Resolves to the sent message ids. */
export async function sendTelegramMessage(chatId: number, replyToMessageId: number, text: string): Promise<number[]> {
  const sentIds: number[] = [];
  for (const chunk of splitTelegramMessage(text, MESSAGE_CHUNK)) {
    sentIds.push(await sendText(chatId, replyToMessageId, { text: chunk, markdown: true }));
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
