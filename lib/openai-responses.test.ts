import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runResponsesTurn, type ResponseTool } from "@/lib/openai-responses";

const tools: ResponseTool[] = [
  { type: "function", name: "save_rfp_summary", description: "save", parameters: { type: "object", properties: {} } },
  { type: "web_search_preview" },
];

type SentRequest = { tools: Array<{ type: string }>; input: unknown[] };

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

const saveCall = { type: "function_call", call_id: "call_1", name: "save_rfp_summary", arguments: "{}" };
const answer = (text: string) => ({ output: [{ type: "message", content: [{ type: "output_text", text }] }] });

/** Fake OpenAI endpoint: hands out the queued replies in order and records each request body. */
function fakeOpenAi(replies: Array<[number, unknown]>): SentRequest[] {
  const sent: SentRequest[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: string, init: RequestInit) => {
      sent.push(JSON.parse(String(init.body)) as SentRequest);
      const [status, body] = replies.shift() ?? [500, { error: { message: "no more replies" } }];
      return jsonResponse(status, body);
    }),
  );
  return sent;
}

describe("runResponsesTurn", () => {
  beforeEach(() => vi.stubEnv("OPENAI_API_KEY", "sk-test"));
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("re-sends only the rejected request without web search and runs each tool once", async () => {
    const sent = fakeOpenAi([
      [200, { output: [saveCall] }],
      [400, { error: { message: "Tool 'web_search_preview' is not supported with this model." } }],
      [200, answer("Saved the summary.")],
    ]);
    const toolRuns: string[] = [];

    const result = await runResponsesTurn({
      instructions: "test",
      input: "save it",
      tools,
      onFunctionCall: async (name) => {
        toolRuns.push(name);
        return "ok";
      },
    });

    expect(result).toBe("Saved the summary.");
    expect(toolRuns).toEqual(["save_rfp_summary"]);
    expect(sent.map((request) => request.tools.map((tool) => tool.type))).toEqual([
      ["function", "web_search_preview"],
      ["function", "web_search_preview"],
      ["function"],
    ]);
    expect(sent[2].input).toHaveLength(3);
  });

  it("fails on an unrelated 400 instead of restarting the turn", async () => {
    fakeOpenAi([
      [200, { output: [saveCall] }],
      [400, { error: { message: "Input is too long for this model." } }],
      [200, answer("should not be reached")],
    ]);
    const toolRuns: string[] = [];

    await expect(
      runResponsesTurn({
        instructions: "test",
        input: "save it",
        tools,
        onFunctionCall: async (name) => {
          toolRuns.push(name);
          return "ok";
        },
      }),
    ).rejects.toThrow("OpenAI request failed (400): Input is too long for this model.");
    expect(toolRuns).toEqual(["save_rfp_summary"]);
  });
});
