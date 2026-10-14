import { describe, expect, it } from "vitest";
import { engagementFor, senderDisplayName } from "@/lib/telegram-bot";
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

    expect(result).toEqual({ respond: true, question: "what's the status of Bathurst?" });
  });

  it("responds to a reply to the bot's own message", () => {
    const result = engagementFor(
      groupMessage({
        text: "and the closing date?",
        reply_to_message: groupMessage({ from: { id: 99, is_bot: true, first_name: "RFPmanager", username: "rfpmanager_bot" } }),
      }),
      bot,
    );

    expect(result).toEqual({ respond: true, question: "and the closing date?" });
  });

  it("ignores ordinary group traffic", () => {
    expect(engagementFor(groupMessage({ text: "did anyone call the client?" }), bot)).toEqual({ respond: false });
  });

  it("ignores mentions of other users", () => {
    expect(engagementFor(groupMessage({ text: "@priya can you check?" }), bot)).toEqual({ respond: false });
  });

  it("answers everything in private chats", () => {
    const result = engagementFor(groupMessage({ chat: { id: 7, type: "private" } }), bot);

    expect(result).toEqual({ respond: true, question: "hello" });
  });

  it("ignores messages without text", () => {
    expect(engagementFor(groupMessage({ text: undefined }), bot)).toEqual({ respond: false });
  });

  it("prompts when the mention carries no question", () => {
    const result = engagementFor(groupMessage({ text: "@rfpmanager_bot" }), bot);

    expect(result.respond).toBe(true);
    if (result.respond) expect(result.question.length).toBeGreaterThan(0);
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
