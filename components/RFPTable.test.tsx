import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RFPTable } from "@/components/RFPTable";
import type { Rfp } from "@/lib/types";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

function dateOffset(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function opportunity(id: string, clientName: string, closingDate: string, stage: Rfp["pipeline_stage"] = "Active"): Rfp {
  return {
    id, client_name: clientName, status: "TBD", closing_date: closingDate, tender_code: null,
    tender_link: null, gdrive_link: null, description: null, contact_person: null,
    contact_phone: null, contact_email: null, document_links: [], summary: null,
    summary_generated_at: null, response_draft_title: null, response_draft_content: null,
    response_draft_saved_at: null, notes: null, pipeline_stage: stage, created_at: "2026-01-01T00:00:00.000Z",
  };
}

describe("RFPTable", () => {
  it("puts upcoming work before expired records and shows the requested columns", () => {
    render(<RFPTable documentCounts={{}} fileCounts={{}} rfps={[
      opportunity("expired", "Expired tender", dateOffset(-10)),
      opportunity("closed", "Won tender", dateOffset(-15), "Won"),
      opportunity("upcoming", "Upcoming tender", dateOffset(3)),
    ]} />);

    const rows = screen.getAllByRole("row").slice(1);
    expect(within(rows[0]).getByRole("link", { name: /Upcoming tender/i })).toBeInTheDocument();
    expect(within(rows[1]).getByRole("link", { name: /Expired tender/i })).toBeInTheDocument();
    expect(within(rows[2]).getByRole("link", { name: /Won tender/i })).toBeInTheDocument();
    expect(screen.getAllByRole("columnheader").map((header) => header.textContent)).toEqual(["Client name", "Closing date", "Tender code", "Links", "Docs", ""]);
    expect(screen.queryByRole("columnheader", { name: "Status" })).not.toBeInTheDocument();
  });

  it("filters the opportunity list by search", () => {
    render(<RFPTable documentCounts={{}} fileCounts={{}} rfps={[
      opportunity("one", "Alpha tender", dateOffset(3)),
      opportunity("two", "Beta tender", dateOffset(4), "Submitted"),
    ]} />);

    fireEvent.change(screen.getByRole("searchbox", { name: "Search opportunities" }), { target: { value: "Alpha" } });
    expect(screen.getAllByRole("row")).toHaveLength(2);
    expect(screen.getAllByRole("link", { name: /Alpha tender/i })).toHaveLength(2);
    expect(screen.queryByText("Beta tender")).not.toBeInTheDocument();
  });

  it("shows the source deadline when no date was parsed", () => {
    render(<RFPTable documentCounts={{}} fileCounts={{}} rfps={[{
      ...opportunity("raw", "Raw deadline tender", ""),
      closing_date: null,
      closing_date_text: "Closing 30 September 2026, 2:00 PM AEST",
    }]} />);
    expect(screen.getAllByText(/Closing 30 September 2026, 2:00 PM AEST/)).toHaveLength(2);
  });
});
