import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET as getRfpById, PATCH } from "@/app/api/chatgpt/rfps/[id]/route";
import { GET, POST } from "@/app/api/chatgpt/rfps/route";
import { createRfp, getRfp, listRfps, updateRfp } from "@/lib/rfps";
import type { Rfp } from "@/lib/types";

vi.mock("@/lib/rfps", async () => {
  const actual = await vi.importActual<typeof import("@/lib/rfps")>("@/lib/rfps");

  return {
    ...actual,
    createRfp: vi.fn(),
    getRfp: vi.fn(),
    listRfps: vi.fn(),
    updateRfp: vi.fn(),
  };
});

const createRfpMock = vi.mocked(createRfp);
const getRfpMock = vi.mocked(getRfp);
const listRfpsMock = vi.mocked(listRfps);
const updateRfpMock = vi.mocked(updateRfp);
const params = Promise.resolve({ id: "rfp-1" });

const rfp: Rfp = {
  id: "rfp-1",
  client_name: "OpenText",
  status: "TBD",
  closing_date: "2026-07-01",
  tender_code: "OT-2026-001",
  tender_link: "https://example.test/tender",
  gdrive_link: null,
  description: "Content management platform renewal",
  contact_person: null,
  contact_phone: null,
  contact_email: null,
  document_links: [],
  summary: null,
  summary_generated_at: null,
  response_draft_title: null,
  response_draft_content: null,
  response_draft_saved_at: null,
  notes: "High priority",
  pipeline_stage: "Active",
  created_at: "2026-06-01T00:00:00.000Z",
};

function request(url: string, init: RequestInit = {}) {
  return new Request(url, {
    ...init,
    headers: {
      authorization: "Bearer secret",
      ...init.headers,
    },
  });
}

describe("ChatGPT RFP routes", () => {
  beforeEach(() => {
    process.env.CHATGPT_ACTIONS_API_KEY = "secret";
    vi.clearAllMocks();
  });

  it("lists RFPs through the RFP record module", async () => {
    listRfpsMock.mockResolvedValue([{ ...rfp }, { ...rfp, id: "rfp-2", client_name: "Other" }]);

    const response = await GET(request("https://rfp.example.test/api/chatgpt/rfps?search=opentext"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(listRfpsMock).toHaveBeenCalledOnce();
    expect(body.rfps).toEqual([rfp]);
  });

  it("creates RFPs through the RFP record module", async () => {
    createRfpMock.mockResolvedValue(rfp);

    const response = await POST(
      request("https://rfp.example.test/api/chatgpt/rfps", {
        body: JSON.stringify({ client_name: "  OpenText  ", closing_date_text: "Closes 1 July 2026" }),
        method: "POST",
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(createRfpMock).toHaveBeenCalledWith(expect.objectContaining({ client_name: "OpenText", closing_date: "2026-07-01" }));
    expect(body.rfp).toEqual(rfp);
  });

  it("loads one RFP through the RFP record module", async () => {
    getRfpMock.mockResolvedValue(rfp);

    const response = await getRfpById(request("https://rfp.example.test/api/chatgpt/rfps/rfp-1"), { params });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(getRfpMock).toHaveBeenCalledWith("rfp-1");
    expect(body.rfp).toEqual(rfp);
  });

  it("updates RFPs through the RFP record module", async () => {
    updateRfpMock.mockResolvedValue({ ...rfp, pipeline_stage: "Submitted" });

    const response = await PATCH(
      request("https://rfp.example.test/api/chatgpt/rfps/rfp-1", {
        body: JSON.stringify({ pipeline_stage: "Submitted", closing_date_text: "Closes 1 July 2026" }),
        method: "PATCH",
      }),
      { params },
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(updateRfpMock).toHaveBeenCalledWith("rfp-1", {
      closing_date: "2026-07-01",
      pipeline_stage: "Submitted",
    });
    expect(body.rfp.pipeline_stage).toBe("Submitted");
  });
});
