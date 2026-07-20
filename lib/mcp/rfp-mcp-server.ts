import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult, ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod/v4";
import { RfpApiClient, createRfpApiClient } from "@/lib/mcp/rfp-api-client";

const rfpId = z.string().uuid().describe("The UUID of the RFP record.");
const optionalText = z.string().nullable().optional();
const status = z.enum(["Yes", "No", "TBD"]).describe("Bid decision only; separate from pipeline_stage.");
const pipelineStage = z
  .enum(["Prospects", "Active", "Submitted", "Won", "Lost"])
  .describe("Workflow stage only; separate from status.");

const listRfpsSchema = {
  search: z.string().trim().optional().describe("Client name, tender code, or keyword to search for."),
  limit: z.number().int().min(1).max(25).optional().describe("Number of records to return (default 25)."),
  offset: z.number().int().min(0).optional().describe("Number of records to skip (default 0)."),
};

const createRfpSchema = {
  client_name: z.string().trim().min(1).describe("Required client or agency name."),
  status: status.optional(),
  closing_date: optionalText.describe("ISO date in YYYY-MM-DD format, if available."),
  closing_date_text: optionalText.describe("Human-readable closing date when an ISO date is unavailable."),
  tender_code: optionalText,
  tender_link: optionalText,
  gdrive_link: optionalText,
  description: optionalText,
  contact_person: optionalText,
  contact_phone: optionalText,
  contact_email: optionalText,
  notes: optionalText,
  pipeline_stage: pipelineStage.optional(),
};

const updateRfpSchema = {
  id: rfpId,
  client_name: z.string().trim().min(1).optional(),
  status: status.optional(),
  closing_date: optionalText,
  closing_date_text: optionalText.describe("Human-readable closing date; parsed when closing_date is omitted."),
  tender_code: optionalText,
  tender_link: optionalText,
  gdrive_link: optionalText,
  description: optionalText,
  contact_person: optionalText,
  contact_phone: optionalText,
  contact_email: optionalText,
  notes: optionalText,
  pipeline_stage: pipelineStage.optional(),
};

const documentListSchema = {
  id: rfpId,
  limit: z.number().int().min(1).max(20).optional().describe("Number of document summaries to return (default 10)."),
  offset: z.number().int().min(0).optional().describe("Number of document summaries to skip (default 0)."),
};

const documentExcerptSchema = {
  id: rfpId,
  document_id: z.string().uuid().describe("The document UUID returned by list_rfp_documents."),
  offset: z.number().int().min(0).optional().describe("Character offset to start reading from (default 0)."),
  limit: z
    .number()
    .int()
    .min(1)
    .max(90000)
    .optional()
    .describe("Maximum characters to return (default 45000; server cap 90000)."),
};

const summarySchema = {
  id: rfpId,
  summary: z.string().trim().min(1).describe("The complete summary text produced after reviewing saved Markdown."),
};

const responseDraftSchema = {
  id: rfpId,
  title: z.string().trim().min(1).describe("Short title for the response draft."),
  content: z.string().trim().min(1).describe("Complete editable proposal response text."),
};

const readAnnotations: ToolAnnotations = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
};

const writeAnnotations: ToolAnnotations = {
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: false,
  openWorldHint: false,
};

function jsonResult(value: unknown): CallToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify(value) }],
  };
}

function errorResult(error: unknown): CallToolResult {
  const message = error instanceof Error ? error.message : "RFPmanager request failed.";
  return {
    isError: true,
    content: [{ type: "text", text: message }],
  };
}

async function run<T>(operation: () => Promise<T>): Promise<CallToolResult> {
  try {
    return jsonResult(await operation());
  } catch (error) {
    return errorResult(error);
  }
}

const descriptions = {
  listRfps:
    "List RFP records. If the user gives a client name, tender code, or keyword, search with this tool first and use the returned UUID for later calls. Follow pagination when has_more is true.",
  getRfp: "Get one RFP by UUID. Only use a UUID returned by list_rfps or a prior response; do not guess UUIDs.",
  createRfp:
    "Create a new RFP record. This changes the shared RFP workspace; use only after confirming the important fields with the user.",
  updateRfp:
    "Update selected fields on an existing RFP. This changes the shared workspace; preserve fields the user did not ask to change. status is the Yes/No/TBD bid decision and pipeline_stage is the workflow stage.",
  listRfpDocuments:
    "List saved Markdown document metadata and short previews for an RFP. Use this before reading full document content.",
  listRfpSourceFiles:
    "List original source files saved for an RFP, including temporary download URLs. Use only when the raw original file is specifically needed.",
  getRfpDocumentMarkdown:
    "Read a bounded Markdown excerpt from one saved document. Start at offset 0 and follow next_offset until has_more is false when a complete review is required.",
  saveRfpSummary:
    "Save a summary created after reviewing the RFP's saved Markdown. This changes the shared workspace and does not call an LLM server-side.",
  listRfpResponses: "List generated response files already saved for an RFP.",
  saveRfpResponseDraft:
    "Save editable response draft text against an RFP. This changes the shared workspace; review the draft and confirm before calling.",
};

export function createRfpMcpServer(client: RfpApiClient = createRfpApiClient()): McpServer {
  const server = new McpServer({ name: "rfpmanager", version: "1.0.0" });

  server.registerTool("list_rfps", { description: descriptions.listRfps, inputSchema: listRfpsSchema, annotations: readAnnotations }, (args) =>
    run(() => client.request("/api/chatgpt/rfps", { query: args })),
  );

  server.registerTool("get_rfp", { description: descriptions.getRfp, inputSchema: { id: rfpId }, annotations: readAnnotations }, ({ id }) =>
    run(() => client.request(`/api/chatgpt/rfps/${id}`)),
  );

  server.registerTool(
    "create_rfp",
    { description: descriptions.createRfp, inputSchema: createRfpSchema, annotations: writeAnnotations },
    (args) => run(() => client.request("/api/chatgpt/rfps", { method: "POST", body: args })),
  );

  server.registerTool(
    "update_rfp",
    { description: descriptions.updateRfp, inputSchema: updateRfpSchema, annotations: writeAnnotations },
    ({ id, ...body }) => run(() => client.request(`/api/chatgpt/rfps/${id}`, { method: "PATCH", body })),
  );

  server.registerTool(
    "list_rfp_documents",
    { description: descriptions.listRfpDocuments, inputSchema: documentListSchema, annotations: readAnnotations },
    ({ id, limit, offset }) =>
      run(() => client.request(`/api/chatgpt/rfps/${id}/documents`, { query: { limit, offset } })),
  );

  server.registerTool(
    "list_rfp_source_files",
    { description: descriptions.listRfpSourceFiles, inputSchema: { id: rfpId }, annotations: readAnnotations },
    ({ id }) => run(() => client.request(`/api/chatgpt/rfps/${id}/source-files`)),
  );

  server.registerTool(
    "get_rfp_document_markdown",
    { description: descriptions.getRfpDocumentMarkdown, inputSchema: documentExcerptSchema, annotations: readAnnotations },
    ({ id, document_id: documentId, limit, offset }) =>
      run(() => client.request(`/api/chatgpt/rfps/${id}/documents/${documentId}`, { query: { limit, offset } })),
  );

  server.registerTool(
    "save_rfp_summary",
    { description: descriptions.saveRfpSummary, inputSchema: summarySchema, annotations: writeAnnotations },
    ({ id, summary }) => run(() => client.request(`/api/chatgpt/rfps/${id}/summary`, { method: "POST", body: { summary } })),
  );

  server.registerTool(
    "list_rfp_responses",
    { description: descriptions.listRfpResponses, inputSchema: { id: rfpId }, annotations: readAnnotations },
    ({ id }) => run(() => client.request(`/api/chatgpt/rfps/${id}/responses`)),
  );

  server.registerTool(
    "save_rfp_response_draft",
    { description: descriptions.saveRfpResponseDraft, inputSchema: responseDraftSchema, annotations: writeAnnotations },
    ({ id, title, content }) =>
      run(() => client.request(`/api/chatgpt/rfps/${id}/responses/text`, { method: "POST", body: { title, content } })),
  );

  return server;
}
