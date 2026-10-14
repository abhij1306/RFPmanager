import { toError } from "@/lib/errors";
import { getSupabase } from "@/lib/supabase";
import { truncate } from "@/lib/display";
import type { HistoryItem } from "@/lib/openai-responses";
import { displayName, type TelegramMessage } from "@/lib/telegram";

/**
 * Conversation memory for the Telegram bot, stored in telegram_exchanges (supabase/telegram-memory-2026-10.sql).
 * A reply to the bot continues that thread; a fresh mention picks up the chat's last few minutes. Memory is
 * best effort: if the table is missing or a query fails, the bot answers without it.
 */

const MAX_THREAD_TURNS = 8;
const RECENT_TURNS = 4;
const RECENT_WINDOW_MS = 30 * 60 * 1000;
const MAX_REMEMBERED_ANSWER = 3000;

export type Exchange = {
  chat_id: number;
  question_message_id: number;
  reply_to_bot_message_id: number | null;
  bot_message_ids: number[];
  asker_name: string;
  question: string;
  answer: string;
  created_at: string;
};

export type MemoryTurn = Pick<Exchange, "asker_name" | "question" | "answer">;

/** What the bot remembers for one incoming message. */
export type Memory =
  | { kind: "thread"; turns: MemoryTurn[] }
  | { kind: "recent"; turns: MemoryTurn[] }
  | { kind: "quoted"; author: string; text: string };

/** The storage the memory needs; tests pass an in-memory version. */
export type ExchangeStore = {
  findByBotMessage(chatId: number, botMessageId: number): Promise<Exchange | null>;
  listRecent(chatId: number, since: Date, limit: number): Promise<Exchange[]>;
  insert(exchange: Omit<Exchange, "created_at">): Promise<void>;
  /** Forget one chat's conversation (/clear). Resolves to the number of exchanges deleted. */
  clearChat(chatId: number): Promise<number>;
};

const exchangeFields =
  "chat_id, question_message_id, reply_to_bot_message_id, bot_message_ids, asker_name, question, answer, created_at";

export const supabaseExchangeStore: ExchangeStore = {
  async findByBotMessage(chatId, botMessageId) {
    const { data, error } = await getSupabase()
      .from("telegram_exchanges")
      .select(exchangeFields)
      .eq("chat_id", chatId)
      .contains("bot_message_ids", [botMessageId])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle<Exchange>();
    if (error) throw toError(error, "Could not load Telegram conversation.");
    return data;
  },

  async listRecent(chatId, since, limit) {
    const { data, error } = await getSupabase()
      .from("telegram_exchanges")
      .select(exchangeFields)
      .eq("chat_id", chatId)
      .gte("created_at", since.toISOString())
      .order("created_at", { ascending: false })
      .limit(limit)
      .overrideTypes<Exchange[], { merge: false }>();
    if (error) throw toError(error, "Could not load Telegram conversation.");
    return data ?? [];
  },

  async insert(exchange) {
    const { error } = await getSupabase().from("telegram_exchanges").insert(exchange);
    if (error) throw toError(error, "Could not save Telegram conversation.");
  },

  async clearChat(chatId) {
    const { data, error } = await getSupabase().rpc("clear_telegram_memory", { p_chat_id: chatId });
    if (error) throw toError(error, "Could not clear Telegram conversation.");
    return Number(data ?? 0);
  },
};

function toTurn(exchange: Exchange): MemoryTurn {
  return { asker_name: exchange.asker_name, question: exchange.question, answer: truncate(exchange.answer, MAX_REMEMBERED_ANSWER) };
}

/** The id of the bot message this message replies to, or null when it is not a reply to the bot. */
function repliedBotMessageId(message: TelegramMessage, botId: number): number | null {
  const parent = message.reply_to_message;
  return parent?.from?.id === botId ? parent.message_id : null;
}

type ExchangeReader = Pick<ExchangeStore, "findByBotMessage" | "listRecent">;

/** Walk a reply thread back from the bot message being replied to, oldest turn first. */
async function loadThread(store: ExchangeReader, chatId: number, botMessageId: number): Promise<MemoryTurn[]> {
  const turns: MemoryTurn[] = [];
  const seen = new Set<number>();
  let next: number | null = botMessageId;

  while (next !== null && turns.length < MAX_THREAD_TURNS && !seen.has(next)) {
    seen.add(next);
    const exchange = await store.findByBotMessage(chatId, next);
    if (!exchange) break;
    turns.unshift(toTurn(exchange));
    next = exchange.reply_to_bot_message_id;
  }

  return turns;
}

export async function loadMemory(
  message: TelegramMessage,
  botId: number,
  { store = supabaseExchangeStore, now = new Date() }: { store?: ExchangeReader; now?: Date } = {},
): Promise<Memory> {
  const parent = message.reply_to_message;
  const parentText = parent ? (parent.text ?? parent.caption ?? "").trim() : "";
  const botParentId = repliedBotMessageId(message, botId);

  if (botParentId !== null) {
    const turns = await loadThread(store, message.chat.id, botParentId);
    if (turns.length > 0) return { kind: "thread", turns };
    // Answer from before memory existed (or not stored): at least the text being replied to is known.
    if (parentText) return { kind: "quoted", author: "you (the bot)", text: parentText };
  } else if (parent && parentText) {
    return { kind: "quoted", author: displayName(parent.from, "a team member"), text: parentText };
  }

  const recent = await store.listRecent(message.chat.id, new Date(now.getTime() - RECENT_WINDOW_MS), RECENT_TURNS);
  return { kind: "recent", turns: recent.reverse().map(toTurn) };
}

/** Save an answered question so later replies and mentions can recall it. */
export function rememberExchange(
  {
    message,
    botId,
    question,
    answer,
    botMessageIds,
  }: { message: TelegramMessage; botId: number; question: string; answer: string; botMessageIds: number[] },
  { store = supabaseExchangeStore }: { store?: Pick<ExchangeStore, "insert"> } = {},
): Promise<void> {
  return store.insert({
    chat_id: message.chat.id,
    question_message_id: message.message_id,
    reply_to_bot_message_id: repliedBotMessageId(message, botId),
    bot_message_ids: botMessageIds,
    asker_name: displayName(message.from, "there"),
    question,
    answer,
  });
}

/** Memory as Responses API input items placed before the new question. */
export function memoryToInput(memory: Memory): HistoryItem[] {
  if (memory.kind !== "quoted" && memory.turns.length === 0) return [];

  switch (memory.kind) {
    case "thread":
    case "recent": {
      const note =
        memory.kind === "thread"
          ? "Earlier in this reply thread:"
          : "Recent conversation in this chat (last 30 minutes) - use it only if the new question follows on from it:";
      return [
        { role: "user", content: note },
        ...memory.turns.flatMap((turn) => [
          { role: "user" as const, content: `${turn.asker_name} asks: ${turn.question}` },
          { role: "assistant" as const, content: turn.answer },
        ]),
      ];
    }
    case "quoted":
      return [{ role: "user", content: `The new question replies to this message from ${memory.author}:\n"""\n${memory.text}\n"""` }];
    default: {
      const _exhaustive: never = memory;
      return _exhaustive;
    }
  }
}
