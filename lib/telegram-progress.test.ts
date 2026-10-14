import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { startProgress } from "@/lib/telegram-progress";

type Call = { method: string; body: Record<string, unknown> };

/** Fake Telegram Bot API: records each call; `fail` decides which calls answer with an error. */
function fakeTelegram(fail: (call: Call) => boolean = () => false): Call[] {
  const calls: Call[] = [];
  let nextId = 100;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit) => {
      const call = { method: url.split("/").pop() ?? "", body: JSON.parse(String(init.body)) as Record<string, unknown> };
      calls.push(call);
      if (fail(call)) return new Response(JSON.stringify({ ok: false, description: "Bad Request: message to edit not found" }), { status: 400 });
      const result = call.method === "sendMessage" ? { message_id: nextId++ } : true;
      return new Response(JSON.stringify({ ok: true, result }), { status: 200 });
    }),
  );
  return calls;
}

const summary = (calls: Call[]) => calls.map((call) => `${call.method}:${String(call.body.message_id ?? "-")}:${String(call.body.text)}`);

describe("startProgress", () => {
  beforeEach(() => vi.stubEnv("TELEGRAM_BOT_TOKEN", "123:test"));
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("posts a placeholder, shows status, then turns it into the answer and sends the rest", async () => {
    const calls = fakeTelegram();

    const progress = await startProgress(-100, 7);
    progress.status("Reading the tender documents…");
    progress.status("Reading the tender documents…");
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

  it("sends the answer fresh when the placeholder can no longer be edited", async () => {
    const calls = fakeTelegram((call) => call.method === "editMessageText");

    const progress = await startProgress(-100, 7);
    const ids = await progress.finish([{ text: "The answer" }]);

    expect(ids).toEqual([101]);
    expect(summary(calls).at(-1)).toBe("sendMessage:-:The answer");
  });
});

describe("formatted sending", () => {
  beforeEach(() => vi.stubEnv("TELEGRAM_BOT_TOKEN", "123:test"));
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("resends as plain text when Telegram can't parse the HTML", async () => {
    const calls: Call[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init: RequestInit) => {
        const body = JSON.parse(String(init.body)) as Record<string, unknown>;
        calls.push({ method: url.split("/").pop() ?? "", body });
        if (body.parse_mode === "HTML") {
          return new Response(JSON.stringify({ ok: false, description: "Bad Request: can't parse entities: unclosed tag" }), { status: 400 });
        }
        return new Response(JSON.stringify({ ok: true, result: { message_id: 5 } }), { status: 200 });
      }),
    );
    const { sendText } = await import("@/lib/telegram");

    const id = await sendText(-100, null, { text: "**Bathurst** closes soon", markdown: true });

    expect(id).toBe(5);
    expect(calls.map((call) => [call.body.parse_mode ?? "plain", call.body.text])).toEqual([
      ["HTML", "<b>Bathurst</b> closes soon"],
      ["plain", "**Bathurst** closes soon"],
    ]);
  });
});
