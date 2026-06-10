import { afterEach, describe, expect, it, vi } from "vitest";
import type { Rfp } from "@/lib/types";

const rfp: Rfp = {
  id: "rfp-1",
  client_name: "Library Management System",
  status: "TBD",
  closing_date: null,
  tender_code: null,
  tender_link: null,
  gdrive_link: null,
  description: null,
  contact_person: null,
  contact_phone: null,
  contact_email: null,
  document_links: [],
  summary: null,
  summary_generated_at: null,
  response_draft_title: null,
  response_draft_content: null,
  response_draft_saved_at: null,
  notes: null,
  pipeline_stage: "Prospects",
  created_at: "2026-06-01T00:00:00.000Z",
};

const originalApiKey = process.env.CHATGPT_ACTIONS_API_KEY;

function request(body: unknown) {
  return new Request("https://rfp.example.test/api/chatgpt/rfps/rfp-1/responses/text", {
    method: "POST",
    headers: {
      authorization: "Bearer secret",
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

async function importRoute(updateRfpResponseDraft = vi.fn()) {
  vi.doMock("@/lib/rfps", () => ({
    getRfp: vi.fn().mockResolvedValue(rfp),
    updateRfpResponseDraft,
  }));

  return import("@/app/api/chatgpt/rfps/[id]/responses/text/route");
}

describe("ChatGPT response draft text route", () => {
  afterEach(() => {
    process.env.CHATGPT_ACTIONS_API_KEY = originalApiKey;
    vi.doUnmock("@/lib/rfps");
    vi.resetModules();
  });

  it("returns 400 for response draft validation errors", async () => {
    process.env.CHATGPT_ACTIONS_API_KEY = "secret";
    const updateRfpResponseDraft = vi.fn();
    const { POST } = await importRoute(updateRfpResponseDraft);

    const response = await POST(request({ title: "   ", content: "Draft" }), { params: Promise.resolve({ id: "rfp-1" }) });

    await expect(response.json()).resolves.toEqual({ error: "title is required." });
    expect(response.status).toBe(400);
    expect(updateRfpResponseDraft).not.toHaveBeenCalled();
  });

  it("returns 500 for unexpected response draft save errors", async () => {
    process.env.CHATGPT_ACTIONS_API_KEY = "secret";
    const { POST } = await importRoute(vi.fn().mockRejectedValue(new Error("database failed")));

    const response = await POST(request({ title: "Draft", content: "Response body" }), {
      params: Promise.resolve({ id: "rfp-1" }),
    });

    await expect(response.json()).resolves.toEqual({ error: "database failed" });
    expect(response.status).toBe(500);
  });
});
