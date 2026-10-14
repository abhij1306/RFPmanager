import { afterEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/telegram/digest/route";

function cronRequest(authorization?: string): Request {
  return new Request("https://example.test/api/telegram/digest", {
    headers: authorization ? { authorization } : {},
  });
}

describe("GET /api/telegram/digest", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("refuses every call when CRON_SECRET is not configured", async () => {
    vi.stubEnv("CRON_SECRET", "");

    expect((await GET(cronRequest("Bearer anything"))).status).toBe(500);
  });

  it("rejects callers without the cron secret", async () => {
    vi.stubEnv("CRON_SECRET", "cron_secret");

    expect((await GET(cronRequest("Bearer wrong"))).status).toBe(403);
    expect((await GET(cronRequest())).status).toBe(401);
  });
});
