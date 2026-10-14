/** Thin client for the OpenAI Responses API: tool loop plus the built-in web search tool. */

type FunctionTool = {
  type: "function";
  name: string;
  description: string;
  parameters: Record<string, unknown>;
};

type WebSearchTool = {
  type: "web_search_preview";
};

export type ResponseTool = FunctionTool | WebSearchTool;

type FunctionCallItem = {
  type: "function_call";
  call_id: string;
  name: string;
  arguments: string;
};

type MessageItem = {
  type: "message";
  content: Array<{ type: string; text?: string }>;
};

type ResponseOutputItem = FunctionCallItem | MessageItem | { type: string };

type ResponsesApiReply = {
  output?: ResponseOutputItem[];
  error?: { message?: string };
};

/** Earlier conversation turns, sent before the new input. */
export type HistoryItem = { role: "user" | "assistant"; content: string };

export type FunctionCallHandler = (name: string, args: Record<string, unknown>) => Promise<string>;

const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
const MAX_TOOL_ROUNDS = 8;

function getOpenAiApiKey(): string {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("Missing OPENAI_API_KEY environment variable.");
  }
  return apiKey;
}

export function getOpenAiModel(): string {
  return process.env.OPENAI_MODEL?.trim() || "gpt-6-luna";
}

export class OpenAiRequestError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(`OpenAI request failed (${status}): ${message}`);
    this.name = "OpenAiRequestError";
  }
}

async function createResponse(payload: Record<string, unknown>, signal?: AbortSignal): Promise<ResponsesApiReply> {
  const response = await fetch(OPENAI_RESPONSES_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${getOpenAiApiKey()}`,
    },
    body: JSON.stringify(payload),
    signal,
  });

  const body = (await response.json().catch(() => ({}))) as ResponsesApiReply;

  if (!response.ok) {
    throw new OpenAiRequestError(response.status, body.error?.message ?? response.statusText);
  }

  return body;
}

/** A 400 that names the web search tool: this model doesn't support it. Other 400s are real failures. */
function isWebSearchRejection(error: unknown): boolean {
  return error instanceof OpenAiRequestError && error.status === 400 && /web_search/i.test(error.message);
}

function extractOutputText(output: ResponseOutputItem[] | undefined): string {
  if (!output) return "";

  return output
    .filter((item): item is MessageItem => item.type === "message")
    .flatMap((item) => item.content)
    .filter((part) => part.type === "output_text" && typeof part.text === "string")
    .map((part) => part.text as string)
    .join("\n")
    .trim();
}

/**
 * Run one brainstorm turn. Function tools are executed locally; the built-in web_search_preview tool is
 * executed by OpenAI. If the model rejects web search, only that request is re-sent without it - tools that
 * already ran (including writes) are never repeated. `signal` aborts the turn, e.g. at the function's deadline.
 */
export async function runResponsesTurn({
  instructions,
  input,
  tools,
  onFunctionCall,
  signal,
  history = [],
}: {
  instructions: string;
  input: string;
  tools: ResponseTool[];
  onFunctionCall: FunctionCallHandler;
  signal?: AbortSignal;
  history?: HistoryItem[];
}): Promise<string> {
  const conversation: unknown[] = [...history, { role: "user", content: input }];
  let activeTools = tools;

  const request = async () => {
    try {
      return await createResponse({ model: getOpenAiModel(), instructions, input: conversation, tools: activeTools }, signal);
    } catch (error) {
      if (!isWebSearchRejection(error) || !activeTools.some((tool) => tool.type === "web_search_preview")) throw error;
      activeTools = activeTools.filter((tool) => tool.type !== "web_search_preview");
      return createResponse({ model: getOpenAiModel(), instructions, input: conversation, tools: activeTools }, signal);
    }
  };

  for (let round = 0; round < MAX_TOOL_ROUNDS; round += 1) {
    const reply = await request();

    const functionCalls = (reply.output ?? []).filter(
      (item): item is FunctionCallItem => item.type === "function_call",
    );

    if (functionCalls.length === 0) {
      const text = extractOutputText(reply.output);
      if (text) return text;
      throw new Error("The model returned no answer.");
    }

    // Echo the calls back with their local results, per the Responses API tool protocol.
    conversation.push(...(reply.output ?? []));

    for (const call of functionCalls) {
      signal?.throwIfAborted();

      let parsedArgs: Record<string, unknown> = {};
      try {
        parsedArgs = JSON.parse(call.arguments || "{}") as Record<string, unknown>;
      } catch {
        parsedArgs = {};
      }

      let output: string;
      try {
        output = await onFunctionCall(call.name, parsedArgs);
      } catch (error) {
        output = `Tool error: ${error instanceof Error ? error.message : "unknown failure"}`;
      }

      conversation.push({ type: "function_call_output", call_id: call.call_id, output });
    }
  }

  throw new Error("The model kept asking for tools without producing an answer.");
}
