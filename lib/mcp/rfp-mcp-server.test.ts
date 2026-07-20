import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RfpApiClient } from "@/lib/mcp/rfp-api-client";
import { createRfpMcpServer } from "@/lib/mcp/rfp-mcp-server";

const rfpId = "11111111-1111-4111-8111-111111111111";
const documentId = "22222222-2222-4222-8222-222222222222";

async function connectedClient(apiClient: RfpApiClient) {
  const server = createRfpMcpServer(apiClient);
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  const client = new Client({ name: "test-client", version: "1.0.0" });
  await client.connect(clientTransport);
  return { client, server };
}

describe("RFPmanager MCP tools", () => {
  beforeEach(() => vi.clearAllMocks());

  it("publishes the ten planned tools and write annotations", async () => {
    const apiClient = { request: vi.fn().mockResolvedValue({}) } as unknown as RfpApiClient;
    const { client } = await connectedClient(apiClient);
    const result = await client.listTools();
    const names = result.tools.map((tool) => tool.name).sort();

    expect(names).toEqual([
      "create_rfp",
      "get_rfp",
      "get_rfp_document_markdown",
      "list_rfp_documents",
      "list_rfp_responses",
      "list_rfp_source_files",
      "list_rfps",
      "save_rfp_response_draft",
      "save_rfp_summary",
      "update_rfp",
    ]);

    expect(result.tools.find((tool) => tool.name === "list_rfps")?.annotations).toMatchObject({ readOnlyHint: true });
    expect(result.tools.find((tool) => tool.name === "save_rfp_summary")?.annotations).toMatchObject({
      readOnlyHint: false,
      destructiveHint: false,
    });
  });

  it("forwards list/search and document pagination", async () => {
    const request = vi.fn().mockResolvedValue({ rfps: [] });
    const apiClient = { request } as unknown as RfpApiClient;
    const { client } = await connectedClient(apiClient);

    await client.callTool({ name: "list_rfps", arguments: { search: "OpenText", limit: 5, offset: 10 } });
    await client.callTool({
      name: "get_rfp_document_markdown",
      arguments: { id: rfpId, document_id: documentId, offset: 45000, limit: 90000 },
    });

    expect(request).toHaveBeenNthCalledWith(1, "/api/chatgpt/rfps", {
      query: { search: "OpenText", limit: 5, offset: 10 },
    });
    expect(request).toHaveBeenNthCalledWith(2, `/api/chatgpt/rfps/${rfpId}/documents/${documentId}`, {
      query: { offset: 45000, limit: 90000 },
    });
  });

  it("maps every read tool to its existing API route", async () => {
    const request = vi.fn().mockResolvedValue({});
    const apiClient = { request } as unknown as RfpApiClient;
    const { client } = await connectedClient(apiClient);

    await client.callTool({ name: "get_rfp", arguments: { id: rfpId } });
    await client.callTool({ name: "list_rfp_documents", arguments: { id: rfpId, limit: 3, offset: 2 } });
    await client.callTool({ name: "list_rfp_source_files", arguments: { id: rfpId } });
    await client.callTool({ name: "list_rfp_responses", arguments: { id: rfpId } });

    expect(request).toHaveBeenNthCalledWith(1, `/api/chatgpt/rfps/${rfpId}`);
    expect(request).toHaveBeenNthCalledWith(2, `/api/chatgpt/rfps/${rfpId}/documents`, {
      query: { limit: 3, offset: 2 },
    });
    expect(request).toHaveBeenNthCalledWith(3, `/api/chatgpt/rfps/${rfpId}/source-files`);
    expect(request).toHaveBeenNthCalledWith(4, `/api/chatgpt/rfps/${rfpId}/responses`);
  });

  it("forwards write bodies without the MCP-only id field", async () => {
    const request = vi.fn().mockResolvedValue({ rfp: {} });
    const apiClient = { request } as unknown as RfpApiClient;
    const { client } = await connectedClient(apiClient);

    await client.callTool({ name: "create_rfp", arguments: { client_name: "OpenText", pipeline_stage: "Active" } });
    await client.callTool({ name: "update_rfp", arguments: { id: rfpId, pipeline_stage: "Submitted" } });
    await client.callTool({ name: "save_rfp_summary", arguments: { id: rfpId, summary: "Summary" } });
    await client.callTool({ name: "save_rfp_response_draft", arguments: { id: rfpId, title: "Draft", content: "Text" } });

    expect(request).toHaveBeenNthCalledWith(1, "/api/chatgpt/rfps", {
      method: "POST",
      body: { client_name: "OpenText", pipeline_stage: "Active" },
    });
    expect(request).toHaveBeenNthCalledWith(2, `/api/chatgpt/rfps/${rfpId}`, {
      method: "PATCH",
      body: { pipeline_stage: "Submitted" },
    });
    expect(request).toHaveBeenNthCalledWith(3, `/api/chatgpt/rfps/${rfpId}/summary`, {
      method: "POST",
      body: { summary: "Summary" },
    });
    expect(request).toHaveBeenNthCalledWith(4, `/api/chatgpt/rfps/${rfpId}/responses/text`, {
      method: "POST",
      body: { title: "Draft", content: "Text" },
    });
  });

  it("rejects invalid UUIDs before making an upstream request", async () => {
    const request = vi.fn().mockResolvedValue({});
    const apiClient = { request } as unknown as RfpApiClient;
    const { client } = await connectedClient(apiClient);

    const result = await client.callTool({ name: "get_rfp", arguments: { id: "not-a-uuid" } });

    expect(result.isError).toBe(true);
    expect(request).not.toHaveBeenCalled();
  });
});
