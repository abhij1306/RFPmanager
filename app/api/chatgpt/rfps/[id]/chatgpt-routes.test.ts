import { afterEach, describe, expect, it } from "vitest";
import { GET as getDocuments } from "@/app/api/chatgpt/rfps/[id]/documents/route";
import { POST as convertDocuments } from "@/app/api/chatgpt/rfps/[id]/documents/convert/route";
import { GET as getResponses, POST as postResponses } from "@/app/api/chatgpt/rfps/[id]/responses/route";
import { POST as postSummary } from "@/app/api/chatgpt/rfps/[id]/summary/route";

const originalApiKey = process.env.CHATGPT_ACTIONS_API_KEY;
const params = Promise.resolve({ id: "00000000-0000-0000-0000-000000000000" });

function request() {
  return new Request("https://rfp.example.test/api/chatgpt/rfps/00000000-0000-0000-0000-000000000000");
}

describe("new ChatGPT RFP endpoints", () => {
  afterEach(() => {
    process.env.CHATGPT_ACTIONS_API_KEY = originalApiKey;
  });

  it("requires ChatGPT auth for document listing", async () => {
    process.env.CHATGPT_ACTIONS_API_KEY = "secret";

    const response = await getDocuments(request(), { params });

    expect(response.status).toBe(401);
  });

  it("requires ChatGPT auth for document conversion", async () => {
    process.env.CHATGPT_ACTIONS_API_KEY = "secret";

    const response = await convertDocuments(request(), { params });

    expect(response.status).toBe(401);
  });

  it("requires ChatGPT auth for summary saves", async () => {
    process.env.CHATGPT_ACTIONS_API_KEY = "secret";

    const response = await postSummary(request(), { params });

    expect(response.status).toBe(401);
  });

  it("requires ChatGPT auth for response listing and upload", async () => {
    process.env.CHATGPT_ACTIONS_API_KEY = "secret";

    await expect(getResponses(request(), { params })).resolves.toHaveProperty("status", 401);
    await expect(postResponses(request(), { params })).resolves.toHaveProperty("status", 401);
  });
});
