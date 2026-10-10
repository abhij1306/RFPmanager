import { beforeEach, describe, expect, it, vi } from "vitest";
import { getDocumentExcerptForChatgpt, listDocumentSummariesForChatgpt } from "@/lib/chatgpt-documents";
import {
  countDocumentsByRfp,
  getDocumentByRfp,
  getDocumentExcerptRow,
  listDocumentSummaryRowsPage,
  listDocumentsPageByRfp,
} from "@/lib/documents";
import { rfpExists } from "@/lib/rfps";
import type { RfpDocument } from "@/lib/types";

vi.mock("@/lib/documents", () => ({
  countDocumentsByRfp: vi.fn(),
  getDocumentByRfp: vi.fn(),
  getDocumentExcerptRow: vi.fn(),
  listDocumentSummaryRowsPage: vi.fn(),
  listDocumentsPageByRfp: vi.fn(),
}));
vi.mock("@/lib/rfps", () => ({ rfpExists: vi.fn() }));

const summaryRowsMock = vi.mocked(listDocumentSummaryRowsPage);
const pageMock = vi.mocked(listDocumentsPageByRfp);
const countMock = vi.mocked(countDocumentsByRfp);
const excerptRowMock = vi.mocked(getDocumentExcerptRow);
const getDocumentMock = vi.mocked(getDocumentByRfp);
const existsMock = vi.mocked(rfpExists);

// 499 ASCII chars then an emoji (2 UTF-16 code units), so the 500-unit preview cuts the surrogate pair.
const markdown = `${"A".repeat(499)}\u{1F600}tail`;
const document: RfpDocument = {
  id: "doc-1",
  rfp_id: "rfp-1",
  source_file_id: "file-1",
  title: "Spec",
  source_filename: "spec.pdf",
  source_type: "pdf",
  markdown,
  created_at: "2026-06-01T00:00:00+00:00",
};
const metadata = {
  id: "doc-1",
  rfp_id: "rfp-1",
  source_file_id: "file-1",
  title: "Spec",
  source_filename: "spec.pdf",
  source_type: "pdf" as const,
  created_at: "2026-06-01T00:00:00+00:00",
};
const expectedSummary = {
  ...metadata,
  markdown_length: 505,
  markdown_preview: `${"A".repeat(499)}\uD83D`,
};

describe("listDocumentSummariesForChatgpt", () => {
  beforeEach(() => vi.resetAllMocks());

  it("builds the page from RPC rows with the same keys, order and values as the in-memory summaries", async () => {
    // The RPC returns left(markdown, 500) in code points; the app trims it to 500 UTF-16 units.
    summaryRowsMock.mockResolvedValue({
      rows: [{ ...metadata, markdown_length: 505, markdown_preview: `${"A".repeat(499)}\u{1F600}` }],
      total: 12,
    });

    const page = await listDocumentSummariesForChatgpt("rfp-1", { offset: 10, limit: 50 });

    expect(summaryRowsMock).toHaveBeenCalledWith("rfp-1", { offset: 10, limit: 20 });
    expect(JSON.stringify(page)).toBe(
      JSON.stringify({ documents: [expectedSummary], total: 12, offset: 10, limit: 20, has_more: true, next_offset: 11 }),
    );
  });

  it("reports totals for an empty RPC page and 404s when the RFP is missing", async () => {
    summaryRowsMock.mockResolvedValue({ rows: [], total: null });
    countMock.mockResolvedValue(3);
    existsMock.mockResolvedValueOnce(true).mockResolvedValueOnce(false);

    await expect(listDocumentSummariesForChatgpt("rfp-1", { offset: 5 })).resolves.toEqual({
      documents: [],
      total: 3,
      offset: 5,
      limit: 10,
      has_more: false,
      next_offset: null,
    });
    await expect(listDocumentSummariesForChatgpt("missing")).resolves.toBeNull();
  });

  it("falls back to loading only the requested page when the RPC is not installed", async () => {
    summaryRowsMock.mockResolvedValue(null);
    pageMock.mockResolvedValue({ documents: [document], total: 2 });

    const page = await listDocumentSummariesForChatgpt("rfp-1", { limit: 1 });

    expect(pageMock).toHaveBeenCalledWith("rfp-1", { offset: 0, limit: 1 });
    expect(JSON.stringify(page)).toBe(
      JSON.stringify({ documents: [expectedSummary], total: 2, offset: 0, limit: 1, has_more: true, next_offset: 1 }),
    );
  });
});

describe("getDocumentExcerptForChatgpt", () => {
  beforeEach(() => vi.resetAllMocks());

  const expectedExcerpt = (slice: string, offset: number, limit: number, nextOffset: number | null) => ({
    ...expectedSummary,
    markdown: slice,
    offset,
    limit,
    next_offset: nextOffset,
    has_more: nextOffset !== null,
  });

  it("uses the server-side slice for BMP-only documents", async () => {
    excerptRowMock.mockResolvedValue({
      ...metadata,
      markdown_length: 505,
      markdown_preview: `${"A".repeat(499)}\u{1F600}`,
      markdown: "AAAA",
      is_full_markdown: false,
    });

    const result = await getDocumentExcerptForChatgpt("rfp-1", "doc-1", { offset: 100, limit: 4 });

    expect(excerptRowMock).toHaveBeenCalledWith("rfp-1", "doc-1", { offset: 100, limit: 4 });
    expect(JSON.stringify(result)).toBe(JSON.stringify({ status: "ok", document: expectedExcerpt("AAAA", 100, 4, 104) }));
  });

  it("slices in JavaScript when the RPC returned the full Markdown", async () => {
    excerptRowMock.mockResolvedValue({
      ...metadata,
      markdown_length: 505,
      markdown_preview: `${"A".repeat(499)}\u{1F600}`,
      markdown,
      is_full_markdown: true,
    });

    const result = await getDocumentExcerptForChatgpt("rfp-1", "doc-1", { offset: 499, limit: 90001 });

    expect(JSON.stringify(result)).toBe(
      JSON.stringify({ status: "ok", document: expectedExcerpt("\u{1F600}tail", 499, 90000, null) }),
    );
  });

  it("falls back to the single document row when the RPC is not installed", async () => {
    excerptRowMock.mockResolvedValue(undefined);
    getDocumentMock.mockResolvedValue(document);

    const result = await getDocumentExcerptForChatgpt("rfp-1", "doc-1", { offset: 0, limit: 3 });

    expect(JSON.stringify(result)).toBe(JSON.stringify({ status: "ok", document: expectedExcerpt("AAA", 0, 3, 3) }));
  });

  it("distinguishes a missing RFP from a missing document only after the lookup misses", async () => {
    excerptRowMock.mockResolvedValue(null);
    existsMock.mockResolvedValueOnce(true).mockResolvedValueOnce(false);

    await expect(getDocumentExcerptForChatgpt("rfp-1", "nope")).resolves.toEqual({ status: "document_not_found" });
    await expect(getDocumentExcerptForChatgpt("missing", "nope")).resolves.toEqual({ status: "rfp_not_found" });
  });
});
