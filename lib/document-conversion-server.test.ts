import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { convertBufferToMarkdown } from "@/lib/document-conversion-server";

async function convertFixture(filename: string) {
  const bytes = await readFile(join(process.cwd(), "tests", "fixtures", "conversion", filename));
  return convertBufferToMarkdown({ buffer: Uint8Array.from(bytes).buffer, filename });
}

describe("AnyDoc server conversion", () => {
  it("preserves Word headings, paragraphs, and tables", async () => {
    const result = await convertFixture("requirements.docx");

    expect(result.sourceType).toBe("docx");
    expect(result.markdown).toContain("# Tender Requirements");
    expect(result.markdown).toContain("The supplier must provide monthly support.");
    expect(result.markdown).toContain("| Routers | 12 |");
  });

  it("preserves Excel rows as a Markdown table", async () => {
    const result = await convertFixture("pricing.xlsx");

    expect(result.sourceType).toBe("xlsx");
    expect(result.markdown).toContain("| Item | Price |");
    expect(result.markdown).toContain("| Support | 1250 |");
  });

  it("extracts selectable text from a PDF", async () => {
    const result = await convertFixture("notice.pdf");

    expect(result.sourceType).toBe("pdf");
    expect(result.markdown).toContain("Tender Notice");
    expect(result.markdown).toContain("Proposals close on 30 June 2026.");
  });

  it("passes an explicit format for CSV files", async () => {
    const result = await convertBufferToMarkdown({
      buffer: new TextEncoder().encode("Item,Price\nSupport,1250").buffer,
      filename: "pricing.csv",
    });

    expect(result.sourceType).toBe("csv");
    expect(result.markdown).toContain("| Support | 1250 |");
  });
});
