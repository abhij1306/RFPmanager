import { beforeEach, describe, expect, it } from "vitest";
import { GET, POST } from "@/app/api/mcp/route";

describe("MCP route", () => {
  beforeEach(() => {
    process.env.RFPMANAGER_API_BASE_URL = "https://rfp.example.test";
    process.env.CHATGPT_ACTIONS_API_KEY = "server-secret";
  });

  it("accepts a stateless Streamable HTTP initialize request", async () => {
    const response = await POST(
      new Request("https://rfp.example.test/api/mcp", {
        method: "POST",
        headers: { Accept: "application/json, text/event-stream", "content-type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "initialize",
          params: {
            protocolVersion: "2025-03-26",
            capabilities: {},
            clientInfo: { name: "test-client", version: "1.0.0" },
          },
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/json");
    const body = await response.json();
    expect(body.result.serverInfo).toMatchObject({ name: "rfpmanager", version: "1.0.0" });
  });

  it("accepts the Streamable HTTP GET stream", async () => {
    const response = await GET(new Request("https://rfp.example.test/api/mcp", { headers: { Accept: "text/event-stream" } }));

    expect(response.status).toBe(200);
  });
});
