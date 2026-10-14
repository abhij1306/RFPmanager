import { toError } from "@/lib/errors";
import { getSupabase } from "@/lib/supabase";
import type { TelegramMessage } from "@/lib/telegram";

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
};

const exchangeFields =
  "chat_id, question_message_id, reply_to_bot_message_id, bot_message_ids, asker_name, question, answer, created_at";

export const supabaseExchangeStore: ExchangeStore & {
  insert(exchange: Omit<Exchange, "created_at">): Promise<void>;
  clearChat(chatId: number): Promise<number>;
} = {
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

  /** Forget one chat's conversation (/clear). Resolves to the number of exchanges deleted. */
  async clearChat(chatId) {
    const { data, error } = await getSupabase().rpc("clear_telegram_memory", { p_chat_id: chatId });
    if (error) throw toError(error, "Could not clear Telegram conversation.");
    return Number(data ?? 0);
  },
};

function toTurn(exchange: Exchange): MemoryTurn {
  const answer =
    exchange.answer.length > MAX_REMEMBERED_ANSWER ? `${exchange.answer.slice(0, MAX_REMEMBERED_ANSWER)}...` : exchange.answer;
  return { asker_name: exchange.asker_name, question: exchange.question, answer };
}

/** Walk a reply thread back from the bot message being replied to, oldest turn first. */
async function loadThread(store: ExchangeStore, chatId: number, botMessageId: number): Promise<MemoryTurn[]> {
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
  { store = supabaseExchangeStore, now = new Date() }: { store?: ExchangeStore; now?: Date } = {},
): Promise<Memory> {
  const parent = message.reply_to_message;
  const parentText = parent ? (parent.text ?? parent.caption ?? "").trim() : "";

  if (parent?.from?.id === botId) {
    const turns = await loadThread(store, message.chat.id, parent.message_id);
    if (turns.length > 0) return { kind: "thread", turns };
    // Answer from before memory existed (or not stored): at least the text being replied to is known.
    if (parentText) return { kind: "quoted", author: "you (the bot)", text: parentText };
  } else if (parent && parentText) {
    const author = [parent.from?.first_name, parent.from?.last_name].filter(Boolean).join(" ") || "a team member";
    return { kind: "quoted", author, text: parentText };
  }

  const recent = await store.listRecent(message.chat.id, new Date(now.getTime() - RECENT_WINDOW_MS), RECENT_TURNS);
  return { kind: "recent", turns: recent.reverse().map(toTurn) };
}

/** Memory as Responses API input items placed before the new question. */
export function memoryToInput(memory: Memory): Array<{ role: "user" | "assistant"; content: string }> {
  switch (memory.kind) {
    case "thread":
    case "recent": {
      const note =
        memory.kind === "thread"
          ? "Earlier in this reply thread:"
          : "Recent conversation in this chat (last 30 minutes) - use it only if the new question follows on from it:";
      if (memory.turns.length === 0) return [];
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
