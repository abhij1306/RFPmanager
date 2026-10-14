import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/telegram/route";

function webhookRequest(secret?: string): Request {
  return new Request("https://example.test/api/telegram", {
    method: "POST",
    headers: secret ? { "x-telegram-bot-api-secret-token": secret } : {},
    body: JSON.stringify({ update_id: 1 }),
  });
}

describe("POST /api/telegram", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("refuses every update when the webhook secret is not configured", async () => {
    vi.stubEnv("TELEGRAM_WEBHOOK_SECRET", "");

    const response = await POST(webhookRequest("anything"));

    expect(response.status).toBe(500);
  });

  it("rejects a wrong secret and accepts the right one", async () => {
    vi.stubEnv("TELEGRAM_WEBHOOK_SECRET", "right_secret");

    expect((await POST(webhookRequest("wrong"))).status).toBe(403);
    expect((await POST(webhookRequest("right_secret"))).status).toBe(200);
  });
});
