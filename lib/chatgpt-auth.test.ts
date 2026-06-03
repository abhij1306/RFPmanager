import { afterEach, describe, expect, it } from "vitest";
import { validateChatgptApiKey } from "@/lib/chatgpt-auth";

const originalApiKey = process.env.CHATGPT_ACTIONS_API_KEY;

function requestWithAuth(value?: string) {
  return new Request("https://rfp.example.test/api/chatgpt/rfps", {
    headers: value ? { Authorization: value } : undefined,
  });
}

describe("ChatGPT Actions API key auth", () => {
  afterEach(() => {
    process.env.CHATGPT_ACTIONS_API_KEY = originalApiKey;
  });

  it("rejects requests when CHATGPT_ACTIONS_API_KEY is not configured", () => {
    delete process.env.CHATGPT_ACTIONS_API_KEY;

    expect(validateChatgptApiKey(requestWithAuth("Bearer secret"))).toEqual({
      ok: false,
      error: "Missing CHATGPT_ACTIONS_API_KEY environment variable.",
      status: 500,
    });
  });

  it("rejects requests without a bearer API key", () => {
    process.env.CHATGPT_ACTIONS_API_KEY = "secret";

    expect(validateChatgptApiKey(requestWithAuth())).toEqual({
      ok: false,
      error: "Missing ChatGPT Actions API key.",
      status: 401,
    });
  });

  it("rejects requests with the wrong bearer API key", () => {
    process.env.CHATGPT_ACTIONS_API_KEY = "secret";

    expect(validateChatgptApiKey(requestWithAuth("Bearer wrong"))).toEqual({
      ok: false,
      error: "Invalid ChatGPT Actions API key.",
      status: 403,
    });
  });

  it("accepts requests with the configured bearer API key", () => {
    process.env.CHATGPT_ACTIONS_API_KEY = "secret";

    expect(validateChatgptApiKey(requestWithAuth("Bearer secret"))).toEqual({ ok: true });
  });
});
