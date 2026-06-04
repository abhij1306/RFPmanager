import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RFPWorkspace } from "@/components/RFPWorkspace";
import type { Rfp } from "@/lib/types";

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
  it("shows a ChatGPT-saved response draft in the response tab", () => {
    render(<RFPWorkspace comments={[]} documents={[]} files={[]} rfp={rfp} />);

    fireEvent.click(screen.getByRole("button", { name: /response/i }));

    expect(screen.getByText("Tender Response Draft")).toBeInTheDocument();
    expect(screen.getByText("We propose a managed content platform implementation.")).toBeInTheDocument();
  });
});
