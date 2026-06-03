import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RFPImportDraft } from "@/components/RFPImportDraft";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
}));

describe("RFPImportDraft", () => {
  it("fills the create form when an import hash appears after the first render", async () => {
    const payload = {
      client_name: "Website hosting and maintenance contract",
      closing_date: "2026-06-30",
      tender_code: "T2026-001",
      tender_link: "https://example.test/tender",
      description: "Imported tender description",
      contact_email: "rajneesh@example.test",
    };
    const importHash = `#import=${encodeURIComponent(JSON.stringify(payload))}`;
    window.location.hash = "";

    const { rerender } = render(<RFPImportDraft />);
    expect(screen.getByLabelText("Client Name")).toHaveValue("");

    window.location.hash = importHash;
    rerender(<RFPImportDraft />);

    expect(screen.getByLabelText("Client Name")).toHaveValue("Website hosting and maintenance contract");
    expect(screen.getByLabelText("Closing Date")).toHaveValue("2026-06-30");
    expect(screen.getByLabelText("Tender Code")).toHaveValue("T2026-001");
    expect(screen.getByLabelText("Tender Link")).toHaveValue("https://example.test/tender");
    expect(screen.getByLabelText("Tender Description")).toHaveValue("Imported tender description");
    expect(screen.getByLabelText("Email")).toHaveValue("rajneesh@example.test");
  });
});
