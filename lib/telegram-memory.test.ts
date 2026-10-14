import { describe, expect, it } from "vitest";
import { loadMemory, memoryToInput, type Exchange, type ExchangeStore } from "@/lib/telegram-memory";
import type { TelegramMessage } from "@/lib/telegram";

const BOT_ID = 99;
const CHAT_ID = -100;
const now = new Date("2026-10-14T10:00:00Z");

function exchange(overrides: Partial<Exchange> & Pick<Exchange, "bot_message_ids" | "question" | "answer">): Exchange {
  return {
    chat_id: CHAT_ID,
    question_message_id: 1,
    reply_to_bot_message_id: null,
    asker_name: "Priya Shah",
    created_at: "2026-10-14T09:50:00Z",
    ...overrides,
  };
}

/** In-memory stand-in for the telegram_exchanges table. */
function storeOf(rows: Exchange[]): ExchangeStore {
  return {
    async findByBotMessage(chatId, botMessageId) {
      return rows.find((row) => row.chat_id === chatId && row.bot_message_ids.includes(botMessageId)) ?? null;
    },
    async listRecent(chatId, since, limit) {
      return rows
        .filter((row) => row.chat_id === chatId && new Date(row.created_at) >= since)
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
        .slice(0, limit);
    },
  };
}

function message(overrides: Partial<TelegramMessage> = {}): TelegramMessage {
  return {
    message_id: 50,
    from: { id: 7, is_bot: false, first_name: "Priya", last_name: "Shah" },
    chat: { id: CHAT_ID, type: "supergroup" },
    text: "@rfpmanager_bot and the closing date?",
    ...overrides,
  };
}

const botReply = (messageId: number): TelegramMessage => ({
  message_id: messageId,
  from: { id: BOT_ID, is_bot: true, first_name: "RFPmanager" },
  chat: { id: CHAT_ID, type: "supergroup" },
  text: "an earlier answer",
});

describe("loadMemory", () => {
  it("walks a reply thread back to its start, oldest first", async () => {
    const store = storeOf([
      exchange({ bot_message_ids: [11], question: "which tenders are open?", answer: "Bathurst and Orange." }),
      exchange({ bot_message_ids: [21, 22], reply_to_bot_message_id: 11, question: "tell me about Bathurst", answer: "It is a water ITSM tender." }),
    ]);

    const memory = await loadMemory(message({ reply_to_message: botReply(22) }), BOT_ID, { store, now });

    expect(memory).toEqual({
      kind: "thread",
      turns: [
        { asker_name: "Priya Shah", question: "which tenders are open?", answer: "Bathurst and Orange." },
        { asker_name: "Priya Shah", question: "tell me about Bathurst", answer: "It is a water ITSM tender." },
      ],
    });
  });

  it("quotes the bot message being replied to when it was never stored", async () => {
    const memory = await loadMemory(message({ reply_to_message: botReply(5) }), BOT_ID, { store: storeOf([]), now });

    expect(memory).toEqual({ kind: "quoted", author: "you (the bot)", text: "an earlier answer" });
  });

  it("quotes a teammate's message when the question replies to it", async () => {
    const teammate: TelegramMessage = {
      message_id: 40,
      from: { id: 8, is_bot: false, first_name: "Arjun" },
      chat: { id: CHAT_ID, type: "supergroup" },
      text: "Should we bid on Orange?",
    };

    const memory = await loadMemory(message({ reply_to_message: teammate }), BOT_ID, { store: storeOf([]), now });

    expect(memory).toEqual({ kind: "quoted", author: "Arjun", text: "Should we bid on Orange?" });
  });

  it("uses only this chat's exchanges from the last 30 minutes for a fresh mention", async () => {
    const store = storeOf([
      exchange({ bot_message_ids: [1], question: "too old", answer: "x", created_at: "2026-10-14T09:00:00Z" }),
      exchange({ bot_message_ids: [2], question: "other chat", answer: "x", chat_id: -555 }),
      exchange({ bot_message_ids: [3], question: "what closes Friday?", answer: "Bathurst.", created_at: "2026-10-14T09:45:00Z" }),
    ]);

    const memory = await loadMemory(message(), BOT_ID, { store, now });

    expect(memory).toEqual({
      kind: "recent",
      turns: [{ asker_name: "Priya Shah", question: "what closes Friday?", answer: "Bathurst." }],
    });
  });
});

describe("memoryToInput", () => {
  it("replays a thread as alternating user and assistant turns", () => {
    expect(
      memoryToInput({ kind: "thread", turns: [{ asker_name: "Priya", question: "which tenders are open?", answer: "Bathurst." }] }),
    ).toEqual([
      { role: "user", content: "Earlier in this reply thread:" },
      { role: "user", content: "Priya asks: which tenders are open?" },
      { role: "assistant", content: "Bathurst." },
    ]);
  });

  it("sends nothing when there is no recent conversation", () => {
    expect(memoryToInput({ kind: "recent", turns: [] })).toEqual([]);
    expect(memoryToInput({ kind: "quoted", author: "Arjun", text: "hi" })).toEqual([
      { role: "user", content: 'The new question replies to this message from Arjun:\n"""\nhi\n"""' },
    ]);
  });
});
