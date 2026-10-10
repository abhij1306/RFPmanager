import * as documentRoute from "@/app/api/chatgpt/rfps/[id]/documents/[documentId]/route";
import * as documentsRoute from "@/app/api/chatgpt/rfps/[id]/documents/route";
import * as responseTextRoute from "@/app/api/chatgpt/rfps/[id]/responses/text/route";
import * as responsesRoute from "@/app/api/chatgpt/rfps/[id]/responses/route";
import * as rfpRoute from "@/app/api/chatgpt/rfps/[id]/route";
import * as sourceFilesRoute from "@/app/api/chatgpt/rfps/[id]/source-files/route";
import * as summaryRoute from "@/app/api/chatgpt/rfps/[id]/summary/route";
import * as rfpsRoute from "@/app/api/chatgpt/rfps/route";
import { RfpApiClient, type RfpApiClientFetch } from "@/lib/mcp/rfp-api-client";

// `never` lets every route's concrete params type ({ id }, { id, documentId }) satisfy this signature.
type RouteHandler = (request: Request, context: { params: Promise<never> }) => Promise<Response>;
type RouteModule = Partial<Record<"GET" | "POST" | "PATCH", RouteHandler>>;

const segment = "([^/]+)";

/**
 * The ChatGPT API routes the MCP tools call, matched most-specific first. Only the routes MCP uses are
 * imported, so the MCP function never loads the document-conversion (WASM) code paths.
 */
const routes: Array<{ pattern: RegExp; params: string[]; module: RouteModule }> = [
  { pattern: new RegExp(`^/api/chatgpt/rfps/${segment}/documents/${segment}$`), params: ["id", "documentId"], module: documentRoute },
  { pattern: new RegExp(`^/api/chatgpt/rfps/${segment}/documents$`), params: ["id"], module: documentsRoute },
  { pattern: new RegExp(`^/api/chatgpt/rfps/${segment}/responses/text$`), params: ["id"], module: responseTextRoute },
  { pattern: new RegExp(`^/api/chatgpt/rfps/${segment}/responses$`), params: ["id"], module: responsesRoute },
  { pattern: new RegExp(`^/api/chatgpt/rfps/${segment}/source-files$`), params: ["id"], module: sourceFilesRoute },
  { pattern: new RegExp(`^/api/chatgpt/rfps/${segment}/summary$`), params: ["id"], module: summaryRoute },
  { pattern: new RegExp(`^/api/chatgpt/rfps/${segment}$`), params: ["id"], module: rfpRoute },
  { pattern: /^\/api\/chatgpt\/rfps$/, params: [], module: rfpsRoute },
];

function jsonError(status: number, error: string): Response {
  return new Response(JSON.stringify({ error }), { status, headers: { "content-type": "application/json" } });
}

/**
 * A fetch implementation that dispatches straight to the ChatGPT API route handlers in this process,
 * instead of making a loopback HTTP request to the public deployment (a second serverless invocation).
 * Responses are the handlers' own, so JSON payloads are identical to the HTTP API.
 */
export const inProcessRfpFetch: RfpApiClientFetch = async (input, init) => {
  const request = input instanceof Request && init === undefined ? input : new Request(input, init);
  const { pathname } = new URL(request.url);

  for (const route of routes) {
    const match = route.pattern.exec(pathname);
    if (!match) continue;

    const handler = route.module[request.method as "GET" | "POST" | "PATCH"];
    if (!handler) return jsonError(405, `Method ${request.method} not allowed.`);

    try {
      const params = Object.fromEntries(route.params.map((name, index) => [name, decodeURIComponent(match[index + 1])]));
      return await handler(request, { params: Promise.resolve(params) as Promise<never> });
    } catch {
      // Next.js answers an unhandled route error with a bare 500; mirror that so callers see the same error.
      return new Response(null, { status: 500 });
    }
  }

  return jsonError(404, "Not found.");
};

/**
 * The MCP server's default client: same request/response contract as the HTTP client, executed in-process.
 * Needs only CHATGPT_ACTIONS_API_KEY (the routes still validate it); RFPMANAGER_API_BASE_URL is not used.
 */
export function createInProcessRfpApiClient(): RfpApiClient {
  return new RfpApiClient({
    baseUrl: "http://rfpmanager.in-process",
    apiKey: process.env.CHATGPT_ACTIONS_API_KEY ?? "",
    fetchImpl: inProcessRfpFetch,
  });
}
