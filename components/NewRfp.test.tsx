import "@testing-library/jest-dom/vitest";
import { act, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { NewRfp, parseImport } from "@/components/NewRfp";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
vi.mock("@/lib/rfp-queries", () => ({ listDuplicateCandidates: vi.fn().mockResolvedValue([]) }));

describe("NewRfp", () => {
  it("fills the form when a bookmarklet capture arrives after the first render", async () => {
    const payload = {
      client_name: "Website hosting and maintenance contract",
      closing_date: "2026-06-30",
      tender_code: "T2026-001",
      tender_link: "https://example.test/tender",
      description: "Imported tender description",
      contact_email: "rajneesh@example.test",
    };
    window.location.hash = "";

    render(<NewRfp />);
    expect(screen.getByLabelText(/RFP name/)).toHaveValue("");

    act(() => {
      window.location.hash = `#import=${encodeURIComponent(JSON.stringify(payload))}`;
      window.dispatchEvent(new Event("hashchange"));
    });

    expect(await screen.findByLabelText(/RFP name/)).toHaveValue("Website hosting and maintenance contract");
    expect(screen.getByLabelText("Closing date")).toHaveValue("2026-06-30");
    expect(screen.getByLabelText("Tender code")).toHaveValue("T2026-001");
    expect(screen.getByLabelText("Tender page")).toHaveValue("https://example.test/tender");
    expect(screen.getByLabelText("Description")).toHaveValue("Imported tender description");
    expect(screen.getByLabelText("Contact email")).toHaveValue("rajneesh@example.test");
  });
});

describe("parseImport", () => {
  it("parses a written deadline into a date and drops non-web document links", () => {
    const raw = `#import=${encodeURIComponent(JSON.stringify({
      client_name: "Library RFT",
      closing_date_text: "Closes 30 September 2026, 2:00 PM AEST",
      document_links: [
        { name: "Spec", url: "https://portal.test/spec.pdf#page=2" },
        { name: "Bad", url: "javascript:alert(1)" },
      ],
    }))}`;

    const result = parseImport(raw);

    expect(result.error).toBeNull();
    expect(result.fields?.closing_date).toBe("2026-09-30");
    expect(result.fields?.document_links).toEqual([{ name: "Spec", url: "https://portal.test/spec.pdf" }]);
  });

  it("reports a capture with no title as an error", () => {
    expect(parseImport(`#import=${encodeURIComponent(JSON.stringify({ tender_code: "X" }))}`).error).toBe(
      "The tender title was not captured. Let the tender page finish loading and try again.",
    );
  });
});
