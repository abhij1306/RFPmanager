import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getRfp } from "@/lib/rfps";
import { createInProcessRfpApiClient, inProcessRfpFetch } from "@/lib/mcp/rfp-in-process-fetch";
import { createRfpMcpServer } from "@/lib/mcp/rfp-mcp-server";

vi.mock("@/lib/rfps", async () => {
  const actual = await vi.importActual<typeof import("@/lib/rfps")>("@/lib/rfps");
  return { ...actual, getRfp: vi.fn() };
});

const getRfpMock = vi.mocked(getRfp);
const rfpId = "11111111-1111-4111-8111-111111111111";

describe("in-process RFP API dispatch", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    process.env.CHATGPT_ACTIONS_API_KEY = "server-secret";
    delete process.env.RFPMANAGER_API_BASE_URL;
  });

  it("serves MCP tools from the route handlers without RFPMANAGER_API_BASE_URL or network", async () => {
    getRfpMock.mockResolvedValue({ id: rfpId, client_name: "OpenText" } as never);
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const server = createRfpMcpServer();
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);
    const client = new Client({ name: "test", version: "1.0.0" });
    await client.connect(clientTransport);

    const result = await client.callTool({ name: "get_rfp", arguments: { id: rfpId } });

    expect(result.content).toEqual([{ type: "text", text: `{"rfp":{"id":"${rfpId}","client_name":"OpenText"}}` }]);
    expect(getRfpMock).toHaveBeenCalledWith(rfpId);
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("maps route 404s and unhandled route errors to the same errors the HTTP client produced", async () => {
    getRfpMock.mockResolvedValueOnce(null);
    const client = createInProcessRfpApiClient();

    await expect(client.request(`/api/chatgpt/rfps/${rfpId}`)).rejects.toThrow("RFP not found.");

    const crash = await inProcessRfpFetch(
      new Request(`http://x/api/chatgpt/rfps/${rfpId}/documents`, { headers: { authorization: "Bearer server-secret" } }),
    );
    // listDocumentSummariesForChatgpt throws without Supabase env; Next.js would answer a bare 500.
    expect(crash.status).toBe(500);
    await expect(crash.text()).resolves.toBe("");
  });

  it("answers unknown paths and methods without throwing", async () => {
    const unknown = await inProcessRfpFetch("http://x/api/chatgpt/other");
    const wrongMethod = await inProcessRfpFetch(`http://x/api/chatgpt/rfps/${rfpId}/source-files`, { method: "PATCH" });

    expect([unknown.status, await unknown.json()]).toEqual([404, { error: "Not found." }]);
    expect([wrongMethod.status, await wrongMethod.json()]).toEqual([405, { error: "Method PATCH not allowed." }]);
  });
});
