import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sendText } from "@/lib/telegram";
import { startProgress } from "@/lib/telegram-progress";

type Call = { method: string; body: Record<string, unknown> };

/** Fake Telegram Bot API: records each call; `failure` returns an error description for calls that should fail. */
function fakeTelegram(failure: (call: Call) => string | null = () => null): Call[] {
  const calls: Call[] = [];
  let nextId = 100;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit) => {
      const call = { method: url.split("/").pop() ?? "", body: JSON.parse(String(init.body)) as Record<string, unknown> };
      calls.push(call);
      const description = failure(call);
      if (description) return new Response(JSON.stringify({ ok: false, description }), { status: 400 });
      const result = call.method === "sendMessage" ? { message_id: nextId++ } : true;
      return new Response(JSON.stringify({ ok: true, result }), { status: 200 });
    }),
  );
  return calls;
}

const summary = (calls: Call[]) => calls.map((call) => `${call.method}:${String(call.body.message_id ?? "-")}:${String(call.body.text)}`);

beforeEach(() => vi.stubEnv("TELEGRAM_BOT_TOKEN", "123:test"));
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("startProgress", () => {
  it("posts a placeholder, shows status, then turns it into the answer and sends the rest", async () => {
    const calls = fakeTelegram();

    const progress = startProgress(-100, 7);
    progress.status("Reading the tender documents…");
    progress.status("Reading the tender documents…");
    await vi.waitFor(() => expect(calls).toHaveLength(2));
    const ids = await progress.finish([{ text: "Part one" }, { text: "Part two" }]);
    progress.status("Checking the tender list…");

    expect(ids).toEqual([100, 101]);
    expect(summary(calls)).toEqual([
      "sendMessage:-:🔎 Looking into it…",
      "editMessageText:100:🔎 Reading the tender documents…",
      "editMessageText:100:Part one",
      "sendMessage:-:Part two",
    ]);
  });

  it("skips statuses nobody would see once the answer is ready", async () => {
    const calls = fakeTelegram();

    const progress = startProgress(-100, 7);
    progress.status("Checking the tender list…");
    progress.status("Reading the tender documents…");
    await progress.finish([{ text: "The answer" }]);

    expect(summary(calls)).toEqual(["sendMessage:-:🔎 Looking into it…", "editMessageText:100:The answer"]);
  });

  it("sends the answer fresh when the placeholder can no longer be edited", async () => {
    const calls = fakeTelegram((call) => (call.method === "editMessageText" ? "Bad Request: message to edit not found" : null));

    const ids = await startProgress(-100, 7).finish([{ text: "The answer" }]);

    expect(ids).toEqual([101]);
    expect(summary(calls).at(-1)).toBe("sendMessage:-:The answer");
  });
});

describe("formatted sending", () => {
  it("resends as plain text when Telegram can't parse the HTML", async () => {
    const calls = fakeTelegram((call) => (call.body.parse_mode === "HTML" ? "Bad Request: can't parse entities: unclosed tag" : null));

    const id = await sendText(-100, null, { text: "**Bathurst** closes soon", markdown: true });

    expect(id).toBe(100);
    expect(calls.map((call) => [call.body.parse_mode ?? "plain", call.body.text])).toEqual([
      ["HTML", "<b>Bathurst</b> closes soon"],
      ["plain", "**Bathurst** closes soon"],
    ]);
  });
});
