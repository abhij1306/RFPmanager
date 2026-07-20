import { describe, expect, it, vi } from "vitest";
import { RfpApiClient, RfpApiError } from "@/lib/mcp/rfp-api-client";

describe("RfpApiClient", () => {
  it("adds the bearer key and forwards query parameters", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ rfps: [], total: 0 }), { status: 200 }),
    );
    const client = new RfpApiClient({ baseUrl: "https://rfp.example.test/", apiKey: "server-secret", fetchImpl });

    await client.request("/api/chatgpt/rfps", { query: { search: "OpenText", limit: 5, offset: 10 } });

    expect(String(fetchImpl.mock.calls[0]?.[0])).toBe("https://rfp.example.test/api/chatgpt/rfps?search=OpenText&limit=5&offset=10");
    expect(fetchImpl.mock.calls[0]?.[1]).toMatchObject({
      method: "GET",
      headers: { Authorization: "Bearer server-secret" },
    });
  });

  it("serializes JSON bodies for writes", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    const client = new RfpApiClient({ baseUrl: "https://rfp.example.test", apiKey: "secret", fetchImpl });

    await client.request("/api/chatgpt/rfps", { method: "POST", body: { client_name: "OpenText" } });

    expect(String(fetchImpl.mock.calls[0]?.[0])).toBe("https://rfp.example.test/api/chatgpt/rfps");
    expect(fetchImpl.mock.calls[0]?.[1]).toMatchObject({
      method: "POST",
      body: JSON.stringify({ client_name: "OpenText" }),
      headers: { "Content-Type": "application/json" },
    });
  });

  it("maps safe upstream errors without exposing server configuration", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ error: "RFP not found." }), { status: 404 }),
    );
    const client = new RfpApiClient({ baseUrl: "https://rfp.example.test", apiKey: "secret-value", fetchImpl });

    const request = client.request("/api/chatgpt/rfps/missing");

    await expect(request).rejects.toEqual(new RfpApiError(404, "RFP not found."));
    await expect(request).rejects.not.toThrow("secret-value");
  });
});
