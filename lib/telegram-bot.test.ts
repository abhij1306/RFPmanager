import { describe, expect, it } from "vitest";
import { accessDeniedReply, chatAccess, engagementFor, parseAllowedChatIds, parseCallbackData, senderDisplayName } from "@/lib/telegram-bot";
import { splitTelegramMessage } from "@/lib/telegram";
import type { TelegramMessage } from "@/lib/telegram";

const bot = { id: 99, username: "rfpmanager_bot" };

function groupMessage(overrides: Partial<TelegramMessage> = {}): TelegramMessage {
  return {
    message_id: 1,
    from: { id: 7, is_bot: false, first_name: "Priya", last_name: "Shah" },
    chat: { id: -100, type: "supergroup" },
    text: "hello",
    ...overrides,
  };
}

describe("engagementFor", () => {
  it("responds when the bot is @mentioned and strips the mention", () => {
    const result = engagementFor(groupMessage({ text: "@rfpmanager_bot what's the status of Bathurst?" }), bot);

    expect(result).toEqual({ respond: true, kind: "question", question: "what's the status of Bathurst?" });
  });

  it("responds to a reply to the bot's own message", () => {
    const result = engagementFor(
      groupMessage({
        text: "and the closing date?",
        reply_to_message: groupMessage({ from: { id: 99, is_bot: true, first_name: "RFPmanager", username: "rfpmanager_bot" } }),
      }),
      bot,
    );

    expect(result).toEqual({ respond: true, kind: "question", question: "and the closing date?" });
  });

  it("ignores ordinary group traffic", () => {
    expect(engagementFor(groupMessage({ text: "did anyone call the client?" }), bot)).toEqual({ respond: false });
  });

  it("ignores mentions of other users", () => {
    expect(engagementFor(groupMessage({ text: "@priya can you check?" }), bot)).toEqual({ respond: false });
  });

  it("answers everything in private chats", () => {
    const result = engagementFor(groupMessage({ chat: { id: 7, type: "private" } }), bot);

    expect(result).toEqual({ respond: true, kind: "question", question: "hello" });
  });

  it("ignores messages without text", () => {
    expect(engagementFor(groupMessage({ text: undefined }), bot)).toEqual({ respond: false });
  });

  it("prompts when the mention carries no question", () => {
    const result = engagementFor(groupMessage({ text: "@rfpmanager_bot" }), bot);

    expect(result).toEqual({ respond: true, kind: "question", question: "Hi! What would you like to know about our tenders?" });
  });
});

describe("engagementFor with Telegram entities", () => {
  it("responds to an exact mention entity and strips it from the middle of the question", () => {
    const text = "hey @RFPmanager_bot when does Bathurst close?";
    const result = engagementFor(groupMessage({ text, entities: [{ type: "mention", offset: 4, length: 15 }] }), bot);

    expect(result).toEqual({ respond: true, kind: "question", question: "hey when does Bathurst close?" });
  });

  it("ignores a mention of a different bot whose name starts with ours", () => {
    const text = "@rfpmanager_bot_old ping";
    const result = engagementFor(groupMessage({ text, entities: [{ type: "mention", offset: 0, length: 19 }] }), bot);

    expect(result).toEqual({ respond: false });
  });

  it("ignores the bot name inside an email address", () => {
    const text = "write to sales@rfpmanager_bot.com please";
    expect(engagementFor(groupMessage({ text, entities: [{ type: "email", offset: 9, length: 24 }] }), bot)).toEqual({
      respond: false,
    });
    expect(engagementFor(groupMessage({ text }), bot)).toEqual({ respond: false });
  });

  it("answers /ask in a group and strips the command", () => {
    const result = engagementFor(
      groupMessage({ text: "/ask@rfpmanager_bot what is due this week?", entities: [{ type: "bot_command", offset: 0, length: 19 }] }),
      bot,
    );

    expect(result).toEqual({ respond: true, kind: "question", question: "what is due this week?" });
  });

  it("ignores commands addressed to another bot", () => {
    const result = engagementFor(
      groupMessage({ text: "/ask@other_bot what is due?", entities: [{ type: "bot_command", offset: 0, length: 14 }] }),
      bot,
    );

    expect(result).toEqual({ respond: false });
  });

  it("answers /start in a private chat with the help text", () => {
    const result = engagementFor(
      groupMessage({ chat: { id: 7, type: "private" }, text: "/start", entities: [{ type: "bot_command", offset: 0, length: 6 }] }),
      bot,
    );

    expect(result).toEqual({ respond: true, kind: "help" });
  });

  it("turns /summary into a draft request for the named tender", () => {
    const result = engagementFor(
      groupMessage({ text: "/summary Bathurst water", entities: [{ type: "bot_command", offset: 0, length: 8 }] }),
      bot,
    );

    expect(result).toEqual({
      respond: true,
      kind: "question",
      question: 'Draft a summary for the tender "Bathurst water" from its converted documents.',
    });
  });

  it("recognises /clear in a group", () => {
    const result = engagementFor(groupMessage({ text: "/clear", entities: [{ type: "bot_command", offset: 0, length: 6 }] }), bot);

    expect(result).toEqual({ respond: true, kind: "clear" });
  });

  it("leaves unknown bare commands in a group to other bots", () => {
    const unknown = (text: string, length: number) =>
      engagementFor(groupMessage({ text, entities: [{ type: "bot_command", offset: 0, length }] }), bot);

    expect(unknown("/poll lunch?", 5)).toEqual({ respond: false });
    expect(unknown("/constructor", 12)).toEqual({ respond: false });
    expect(unknown("/poll@rfpmanager_bot lunch?", 20)).toEqual({ respond: true, kind: "help" });
  });
});

describe("commands", () => {
  it("answers /digest in a group without the model", () => {
    const result = engagementFor(groupMessage({ text: "/digest", entities: [{ type: "bot_command", offset: 0, length: 7 }] }), bot);

    expect(result).toEqual({ respond: true, kind: "digest" });
  });

  it("turns /summary into a draft request rather than a save", () => {
    const result = engagementFor(groupMessage({ text: "/summary Orange", entities: [{ type: "bot_command", offset: 0, length: 8 }] }), bot);

    expect(result).toEqual({
      respond: true,
      kind: "question",
      question: 'Draft a summary for the tender "Orange" from its converted documents.',
    });
  });
});

describe("parseCallbackData", () => {
  it("reads the bot's own button payloads and ignores anything else", () => {
    expect(parseCallbackData("more")).toEqual({ kind: "more" });
    expect(parseCallbackData("save:6f1c2a7e-0b9d-4c3e-9a51-2f8d7e6c5b4a")).toEqual({
      kind: "save",
      rfpId: "6f1c2a7e-0b9d-4c3e-9a51-2f8d7e6c5b4a",
    });
    expect(parseCallbackData("save:not-a-uuid")).toEqual({ kind: "ignore" });
    expect(parseCallbackData(undefined)).toEqual({ kind: "ignore" });
  });
});

describe("parseAllowedChatIds", () => {
  it("reads comma and space separated ids and drops junk", () => {
    expect([...parseAllowedChatIds("-1001234567890, -42 abc,, 0")]).toEqual([-1001234567890, -42]);
  });

  it("survives what a dashboard paste adds: name prefix, quotes, brackets, typographic minus", () => {
    expect([...parseAllowedChatIds('TELEGRAM_ALLOWED_CHAT_IDS="-1001234567890"')]).toEqual([-1001234567890]);
    expect([...parseAllowedChatIds("['−1001234567890'; '–42']")]).toEqual([-1001234567890, -42]);
  });
});

describe("accessDeniedReply", () => {
  const unlisted = groupMessage({ chat: { id: -1009, type: "supergroup" } });

  it("says when the deployment loaded no chat IDs at all", () => {
    expect(accessDeniedReply("chat_not_allowed", unlisted, 0)).toBe(
      [
        "This group isn't enabled for the RFPmanager bot yet.",
        "Chat ID: -1009",
        "This deployment has no allowed chat IDs: TELEGRAM_ALLOWED_CHAT_IDS is missing for Production, empty, or not a number. Set it to the chat ID above and redeploy.",
      ].join("\n"),
    );
  });

  it("says when other IDs loaded but this one does not match", () => {
    expect(accessDeniedReply("chat_not_allowed", unlisted, 1).split("\n")[2]).toBe(
      "This deployment allows 1 other chat ID, but not this one. Make TELEGRAM_ALLOWED_CHAT_IDS match the chat ID above exactly (minus sign included) and redeploy.",
    );
  });
});

describe("chatAccess", () => {
  const allowed = new Set([-100]);
  const memberOf = (groupId: number, memberId: number) => async (chatId: number, userId: number) =>
    chatId === groupId && userId === memberId;

  it("allows listed groups and refuses others", async () => {
    expect(await chatAccess(groupMessage(), allowed)).toBe("allowed");
    expect(await chatAccess(groupMessage({ chat: { id: -555, type: "group" } }), allowed)).toBe("chat_not_allowed");
  });

  it("allows private chats only with members of an allowed group", async () => {
    const dm = groupMessage({ chat: { id: 7, type: "private" } });

    expect(await chatAccess(dm, allowed, memberOf(-100, 7))).toBe("allowed");
    expect(await chatAccess(dm, allowed, memberOf(-100, 8))).toBe("not_a_member");
  });

  it("treats a failed membership lookup as not a member", async () => {
    const dm = groupMessage({ chat: { id: 7, type: "private" } });
    const failing = async () => {
      throw new Error("Telegram getChatMember failed (400)");
    };

    expect(await chatAccess(dm, allowed, failing)).toBe("not_a_member");
  });
});

describe("senderDisplayName", () => {
  it("joins first and last name", () => {
    expect(senderDisplayName(groupMessage())).toBe("Priya Shah");
  });

  it("falls back to the username", () => {
    expect(
      senderDisplayName(groupMessage({ from: { id: 7, is_bot: false, first_name: "", username: "priya" } })),
    ).toBe("priya");
  });
});

describe("splitTelegramMessage", () => {
  it("keeps short messages in one chunk", () => {
    expect(splitTelegramMessage("short answer")).toEqual(["short answer"]);
  });

  it("splits long messages on paragraph boundaries", () => {
    const text = Array.from({ length: 200 }, (_, i) => `Paragraph ${i} ${"x".repeat(30)}`).join("\n\n");
    const chunks = splitTelegramMessage(text, 500);

    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) expect(chunk.length).toBeLessThanOrEqual(500);
    expect(chunks.join("")).toContain("Paragraph 0");
    expect(chunks.join("")).toContain("Paragraph 199");
  });
});
