import "@testing-library/jest-dom/vitest";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RFPWorkspace } from "@/components/RFPWorkspace";
import { updateRfpResponseDraft, updateRfpSummary } from "@/lib/rfps";
import type { Rfp, RfpComment, RfpDocument } from "@/lib/types";

vi.mock("@/lib/rfps", () => ({ updateRfpResponseDraft: vi.fn(), updateRfpSummary: vi.fn() }));

const rfp: Rfp = {
  id: "rfp-1",
  client_name: "OpenText",
  status: "TBD",
  closing_date: "2026-07-01",
  tender_code: "OT-2026-001",
  tender_link: null,
  gdrive_link: null,
  description: null,
  contact_person: null,
  contact_phone: null,
  contact_email: null,
  document_links: [],
  summary: null,
  summary_generated_at: null,
  response_draft_title: "Tender Response Draft",
  response_draft_content: "We propose a managed content platform implementation.",
  response_draft_saved_at: "2026-06-04T04:00:00.000Z",
  notes: null,
  pipeline_stage: "Active",
  created_at: "2026-06-01T00:00:00.000Z",
};

describe("RFPWorkspace", () => {
  beforeEach(() => vi.resetAllMocks());

  it("keeps imported tender links out of the document library", () => {
    const linkedRfp: Rfp = {
      ...rfp,
      document_links: [{ name: "Submit response", url: "https://example.com/respond" }],
    };

    render(<RFPWorkspace comments={[]} documentTotalCount={0} documents={[]} files={[]} rfp={linkedRfp} />);

    const navigation = screen.getByRole("navigation", { name: "RFP workspace" });
    expect(within(navigation).getByRole("button", { name: /documents/i })).toHaveTextContent("0");
    expect(screen.getByRole("link", { name: /Submit response/i })).toBeInTheDocument();
    fireEvent.click(within(navigation).getByRole("button", { name: /documents/i }));
    expect(screen.queryByRole("link", { name: /Submit response/i })).not.toBeInTheDocument();
    expect(screen.getByText("No documents match this view.")).toBeInTheDocument();
  });

  it("loads document Markdown only after the document is selected", async () => {
    const sourceDocument: RfpDocument = {
      id: "doc-1",
      rfp_id: "rfp-1",
      source_file_id: null,
      title: "Tender specification",
      source_filename: "specification.pdf",
      source_type: "pdf",
      markdown: "",
      created_at: "2026-06-01T00:00:00.000Z",
    };
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ document: { id: "doc-1", markdown: "# Loaded specification" } }), { status: 200 }),
    );

    try {
      render(<RFPWorkspace comments={[]} documentTotalCount={1} documents={[sourceDocument]} files={[]} rfp={rfp} />);
      fireEvent.click(within(screen.getByRole("navigation", { name: "RFP workspace" })).getByRole("button", { name: /documents/i }));

      expect(await screen.findByRole("heading", { name: "Loaded specification" })).toBeInTheDocument();
      expect(fetchMock).toHaveBeenCalledWith("/api/rfp/rfp-1/documents/doc-1");
    } finally {
      fetchMock.mockRestore();
    }
  });

  it("shows a ChatGPT-saved response draft in the response tab", () => {
    render(<RFPWorkspace comments={[]} documentTotalCount={0} documents={[]} files={[]} rfp={rfp} />);

    fireEvent.click(within(screen.getByRole("navigation", { name: "RFP workspace" })).getByRole("button", { name: /response/i }));

    expect(screen.getByRole("textbox", { name: "Response draft title" })).toHaveValue("Tender Response Draft");
    expect(screen.getByRole("textbox", { name: "Response draft Markdown" })).toHaveValue("We propose a managed content platform implementation.");
  });

  it("copies the response draft text", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    render(<RFPWorkspace comments={[]} documentTotalCount={0} documents={[]} files={[]} rfp={rfp} />);

    fireEvent.click(within(screen.getByRole("navigation", { name: "RFP workspace" })).getByRole("button", { name: /response/i }));
    fireEvent.click(screen.getByRole("button", { name: /copy draft/i }));

    expect(writeText).toHaveBeenCalledWith("We propose a managed content platform implementation.");
    expect(await screen.findByText("Response draft copied to clipboard.")).toBeInTheDocument();
  });

  it("saves edits to the existing shared response draft", async () => {
    vi.mocked(updateRfpResponseDraft).mockResolvedValue({
      ...rfp,
      response_draft_content: "Updated response",
      response_draft_saved_at: "2026-06-05T04:00:00.000Z",
    });
    render(<RFPWorkspace comments={[]} documentTotalCount={0} documents={[]} files={[]} rfp={rfp} />);
    fireEvent.click(within(screen.getByRole("navigation", { name: "RFP workspace" })).getByRole("button", { name: /response/i }));
    fireEvent.change(screen.getByRole("textbox", { name: "Response draft Markdown" }), { target: { value: "Updated response" } });
    fireEvent.click(screen.getByRole("button", { name: "Save draft" }));

    expect(await screen.findByText("Response draft saved to the shared workspace.")).toBeInTheDocument();
    expect(updateRfpResponseDraft).toHaveBeenCalledWith("rfp-1", "Tender Response Draft", "Updated response");
  });

  it("clears saved assessment and response text, including after reload", async () => {
    const savedRfp = { ...rfp, summary: "Existing assessment", summary_generated_at: "2026-06-04T04:00:00.000Z" };
    const clearedRfp = { ...savedRfp, summary: "", response_draft_content: "" };
    vi.mocked(updateRfpSummary).mockResolvedValue(clearedRfp);
    vi.mocked(updateRfpResponseDraft).mockResolvedValue(clearedRfp);
    const view = render(<RFPWorkspace comments={[]} documentTotalCount={0} documents={[]} files={[]} rfp={savedRfp} />);
    const navigation = screen.getByRole("navigation", { name: "RFP workspace" });

    fireEvent.click(within(navigation).getByRole("button", { name: /assessment/i }));
    fireEvent.click(screen.getByRole("button", { name: "Edit assessment" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Assessment Markdown" }), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Save assessment" }));
    expect(await screen.findByText("Assessment saved to the shared workspace.")).toBeInTheDocument();
    expect(updateRfpSummary).toHaveBeenCalledWith("rfp-1", "");
    expect(screen.getByText("No assessment saved yet")).toBeInTheDocument();

    fireEvent.click(within(navigation).getByRole("button", { name: /response/i }));
    fireEvent.change(screen.getByRole("textbox", { name: "Response draft Markdown" }), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Save draft" }));
    expect(await screen.findByText("Response draft saved to the shared workspace.")).toBeInTheDocument();
    expect(updateRfpResponseDraft).toHaveBeenCalledWith("rfp-1", "Tender Response Draft", "");
    expect(screen.getByText("No draft saved yet")).toBeInTheDocument();

    view.unmount();
    render(<RFPWorkspace comments={[]} documentTotalCount={0} documents={[]} files={[]} rfp={clearedRfp} />);
    fireEvent.click(within(screen.getByRole("navigation", { name: "RFP workspace" })).getByRole("button", { name: /response/i }));
    expect(screen.getByRole("textbox", { name: "Response draft Markdown" })).toHaveValue("");
    expect(screen.getByText("No draft saved yet")).toBeInTheDocument();
  });

  it("locks assessment and response editors while their save requests are pending", async () => {
    const savedRfp = { ...rfp, summary: "Existing assessment", summary_generated_at: "2026-06-04T04:00:00.000Z" };
    let resolveAssessment!: (value: Rfp) => void;
    let resolveResponse!: (value: Rfp) => void;
    vi.mocked(updateRfpSummary).mockImplementation(() => new Promise((resolve) => { resolveAssessment = resolve; }));
    vi.mocked(updateRfpResponseDraft).mockImplementation(() => new Promise((resolve) => { resolveResponse = resolve; }));
    render(<RFPWorkspace comments={[]} documentTotalCount={0} documents={[]} files={[]} rfp={savedRfp} />);
    const navigation = screen.getByRole("navigation", { name: "RFP workspace" });

    fireEvent.click(within(navigation).getByRole("button", { name: /assessment/i }));
    fireEvent.click(screen.getByRole("button", { name: "Edit assessment" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Assessment Markdown" }), { target: { value: "Revised assessment" } });
    fireEvent.click(screen.getByRole("button", { name: "Save assessment" }));
    expect(screen.getByRole("textbox", { name: "Assessment Markdown" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
    await act(async () => resolveAssessment({ ...savedRfp, summary: "Revised assessment" }));

    fireEvent.click(within(navigation).getByRole("button", { name: /response/i }));
    fireEvent.change(screen.getByRole("textbox", { name: "Response draft Markdown" }), { target: { value: "Revised draft" } });
    fireEvent.click(screen.getByRole("button", { name: "Save draft" }));
    expect(screen.getByRole("textbox", { name: "Response draft title" })).toBeDisabled();
    expect(screen.getByRole("textbox", { name: "Response draft Markdown" })).toBeDisabled();
    await act(async () => resolveResponse({ ...savedRfp, response_draft_content: "Revised draft" }));
    expect(updateRfpResponseDraft).toHaveBeenCalledWith("rfp-1", "Tender Response Draft", "Revised draft");
  });

  it("reconciles refreshed server data with local workspace state", async () => {
    const comment: RfpComment = {
      id: "comment-1",
      rfp_id: "rfp-1",
      author_name: "Team",
      body: "Added after a server refresh",
      created_at: "2026-08-10T00:00:00.000Z",
    };
    const view = render(<RFPWorkspace comments={[]} documentTotalCount={0} documents={[]} files={[]} rfp={rfp} />);

    view.rerender(<RFPWorkspace comments={[comment]} documentTotalCount={0} documents={[]} files={[]} rfp={rfp} />);

    expect(within(screen.getByRole("navigation", { name: "RFP workspace" })).getByRole("button", { name: /team notes/i })).toHaveTextContent("1");
  });
});
