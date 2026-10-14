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

async function createResponse(payload: Record<string, unknown>): Promise<ResponsesApiReply> {
  const response = await fetch(OPENAI_RESPONSES_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${getOpenAiApiKey()}`,
    },
    body: JSON.stringify(payload),
  });

  const body = (await response.json().catch(() => ({}))) as ResponsesApiReply;

  if (!response.ok) {
    throw new Error(`OpenAI request failed (${response.status}): ${body.error?.message ?? response.statusText}`);
  }

  return body;
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
 * executed by OpenAI. If the model rejects web search (unknown tool for that model), retry without it.
 */
export async function runResponsesTurn({
  instructions,
  input,
  tools,
  onFunctionCall,
}: {
  instructions: string;
  input: string;
  tools: ResponseTool[];
  onFunctionCall: FunctionCallHandler;
}): Promise<string> {
  const withWebSearch = tools.some((tool) => tool.type === "web_search_preview");

  try {
    return await runLoop({ instructions, input, tools, onFunctionCall });
  } catch (error) {
    // Unknown-tool rejections (older models without web search) come back as 400s: retry without it.
    if (withWebSearch && error instanceof Error && /\(400\)/.test(error.message)) {
      const withoutWebSearch = tools.filter((tool) => tool.type !== "web_search_preview");
      return runLoop({ instructions, input, tools: withoutWebSearch, onFunctionCall });
    }
    throw error;
  }
}

async function runLoop({
  instructions,
  input,
  tools,
  onFunctionCall,
}: {
  instructions: string;
  input: string;
  tools: ResponseTool[];
  onFunctionCall: FunctionCallHandler;
}): Promise<string> {
  const conversation: unknown[] = [{ role: "user", content: input }];

  for (let round = 0; round < MAX_TOOL_ROUNDS; round += 1) {
    const reply = await createResponse({
      model: getOpenAiModel(),
      instructions,
      input: conversation,
      tools,
    });

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
