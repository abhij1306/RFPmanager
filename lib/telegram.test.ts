import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const botUser = { id: 99, is_bot: true, first_name: "RFPmanager", username: "rfpmanager_bot" };

describe("getBotUser", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("TELEGRAM_BOT_TOKEN", "123:test");
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("recovers after a failed getMe instead of caching the failure", async () => {
    const replies = [
      new Response("<html>Bad Gateway</html>", { status: 502, statusText: "Bad Gateway" }),
      new Response(JSON.stringify({ ok: true, result: botUser }), { status: 200 }),
    ];
    vi.stubGlobal("fetch", vi.fn(async () => replies.shift()));
    const { getBotUser } = await import("@/lib/telegram");

    await expect(getBotUser()).rejects.toThrow("Telegram getMe failed (502): Bad Gateway");
    await expect(getBotUser()).resolves.toEqual(botUser);
  });
});
