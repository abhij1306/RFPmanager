import { describe, expect, it } from "vitest";
import {
  getAllowedFileSourceType,
  normalizeOpenAiFileRefs,
  validateSummaryInput,
} from "@/lib/chatgpt-files";

describe("ChatGPT file helpers", () => {
  it("rejects payloads without OpenAI file references", () => {
    expect(() => normalizeOpenAiFileRefs({})).toThrow("openaiFileIdRefs must include at least one file.");
  });

  it("normalizes OpenAI file references with temporary download links", () => {
    expect(
      normalizeOpenAiFileRefs({
        openaiFileIdRefs: [
          {
            id: "file-123",
            name: "Tender.pdf",
            mime_type: "application/pdf",
            download_link: "https://files.example.test/tender.pdf",
          },
        ],
      }),
    ).toEqual([
      {
        id: "file-123",
        name: "Tender.pdf",
        mimeType: "application/pdf",
        downloadLink: "https://files.example.test/tender.pdf",
      },
    ]);
  });

  it("detects supported source document types", () => {
    expect(getAllowedFileSourceType("response.DOCX")).toBe("docx");
    expect(getAllowedFileSourceType("pricing.xlsx")).toBe("xlsx");
    expect(getAllowedFileSourceType("notes.txt")).toBe("markdown");
  });

  it("rejects legacy XLS files", () => {
    expect(() => getAllowedFileSourceType("legacy.xls")).toThrow(
      "Legacy XLS files are not supported. Save the spreadsheet as XLSX or CSV first.",
    );
  });

  it("rejects empty GPT-created summaries", () => {
    expect(() => validateSummaryInput({ summary: "   " })).toThrow("summary is required.");
  });

  it("trims GPT-created summaries", () => {
    expect(validateSummaryInput({ summary: "\nKey requirements\n" })).toBe("Key requirements");
  });
});
