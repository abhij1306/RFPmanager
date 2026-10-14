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

/**
 * Check the request's `Authorization: Bearer` token against an env var. Fails closed: 500 when the env var
 * is unset, 401 when no token was sent, 403 when it doesn't match.
 */
export function validateBearerSecret(request: Request, envName: string, secretLabel: string): ApiKeyValidation {
  const expectedSecret = process.env[envName];

  if (!expectedSecret) {
    return {
      ok: false,
      error: `Missing ${envName} environment variable.`,
      status: 500,
    };
  }

  const providedSecret = getBearerToken(request);

  if (!providedSecret) {
    return {
      ok: false,
      error: `Missing ${secretLabel}.`,
      status: 401,
    };
  }

  if (providedSecret !== expectedSecret) {
    return {
      ok: false,
      error: `Invalid ${secretLabel}.`,
      status: 403,
    };
  }

  return { ok: true };
}

export function validateChatgptApiKey(request: Request): ApiKeyValidation {
  return validateBearerSecret(request, "CHATGPT_ACTIONS_API_KEY", "ChatGPT Actions API key");
}

export function chatgptAuthErrorResponse(validation: Exclude<ApiKeyValidation, { ok: true }>) {
  return NextResponse.json({ error: validation.error }, { status: validation.status });
}
