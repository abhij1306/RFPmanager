import { NextResponse } from "next/server";

type ApiKeyValidation =
  | {
      ok: true;
    }
  | {
      ok: false;
      error: string;
      status: number;
    };

function getBearerToken(request: Request): string | null {
  const authorization = request.headers.get("authorization");
  const match = authorization?.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}

export function validateChatgptApiKey(request: Request): ApiKeyValidation {
  const expectedApiKey = process.env.CHATGPT_ACTIONS_API_KEY;

  if (!expectedApiKey) {
    return {
      ok: false,
      error: "Missing CHATGPT_ACTIONS_API_KEY environment variable.",
      status: 500,
    };
  }

  const providedApiKey = getBearerToken(request);

  if (!providedApiKey) {
    return {
      ok: false,
      error: "Missing ChatGPT Actions API key.",
      status: 401,
    };
  }

  if (providedApiKey !== expectedApiKey) {
    return {
      ok: false,
      error: "Invalid ChatGPT Actions API key.",
      status: 403,
    };
  }

  return { ok: true };
}

export function chatgptAuthErrorResponse(validation: Exclude<ApiKeyValidation, { ok: true }>) {
  return NextResponse.json({ error: validation.error }, { status: validation.status });
}
