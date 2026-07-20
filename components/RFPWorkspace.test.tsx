import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RFPWorkspace } from "@/components/RFPWorkspace";
import type { Rfp, RfpDocument } from "@/lib/types";

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

      expect(await screen.findByText("# Loaded specification")).toBeInTheDocument();
      expect(fetchMock).toHaveBeenCalledWith("/api/rfp/rfp-1/documents/doc-1");
    } finally {
      fetchMock.mockRestore();
    }
  });

  it("shows a ChatGPT-saved response draft in the response tab", () => {
    render(<RFPWorkspace comments={[]} documentTotalCount={0} documents={[]} files={[]} rfp={rfp} />);

    fireEvent.click(screen.getByRole("button", { name: /response/i }));

    expect(screen.getByText("Tender Response Draft")).toBeInTheDocument();
    expect(screen.getByText("We propose a managed content platform implementation.")).toBeInTheDocument();
  });

  it("copies the response draft text", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    render(<RFPWorkspace comments={[]} documentTotalCount={0} documents={[]} files={[]} rfp={rfp} />);

    fireEvent.click(screen.getByRole("button", { name: /response/i }));
    fireEvent.click(screen.getByRole("button", { name: /copy draft/i }));

    expect(writeText).toHaveBeenCalledWith("We propose a managed content platform implementation.");
    expect(await screen.findByText("Response draft copied to clipboard.")).toBeInTheDocument();
  });
});
