import { describe, expect, it } from "vitest";
import type { Rfp, RfpDocument } from "@/lib/types";
import { createDocumentExcerpt, paginateDocumentSummaries, toDocumentSummary } from "@/lib/chatgpt-documents";
import { filterRfpsForChatgpt, paginateRfpsForChatgpt } from "@/lib/chatgpt-rfps";
import { toSourceFileSummaries } from "@/lib/chatgpt-source-files";

const document: RfpDocument = {
  id: "document-1",
  rfp_id: "rfp-1",
  source_file_id: "file-1",
  title: "Tender specification",
  source_filename: "spec.pdf",
  source_type: "pdf",
  markdown: "A".repeat(1500),
  created_at: "2026-06-01T00:00:00.000Z",
};

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

describe("ChatGPT action helpers", () => {
  it("summarizes documents without returning full markdown", () => {
    const summary = toDocumentSummary(document);

    expect(summary).not.toHaveProperty("markdown");
    expect(summary.markdown_length).toBe(1500);
    expect(summary.markdown_preview).toHaveLength(500);
  });

  it("creates bounded document excerpts", () => {
    const excerpt = createDocumentExcerpt(document, { offset: 100, limit: 200 });

    expect(excerpt.markdown).toHaveLength(200);
    expect(excerpt.offset).toBe(100);
    expect(excerpt.next_offset).toBe(300);
    expect(excerpt.has_more).toBe(true);
  });

  it("paginates document summaries with a maximum page size", () => {
    const documents = Array.from({ length: 25 }, (_, index) => ({
      ...document,
      id: `document-${index}`,
      markdown: `${index}`.repeat(600),
    }));

    const page = paginateDocumentSummaries(documents, { offset: 5, limit: 50 });

    expect(page.documents).toHaveLength(20);
    expect(page.total).toBe(25);
    expect(page.offset).toBe(5);
    expect(page.limit).toBe(20);
    expect(page.next_offset).toBeNull();
    expect(page.has_more).toBe(false);
    expect(page.documents[0]).not.toHaveProperty("markdown");
    expect(page.documents[0].markdown_preview).toHaveLength(500);
  });

  it("filters RFPs by client name, tender code, description, and notes", () => {
    expect(filterRfpsForChatgpt([rfp], "opentext")).toHaveLength(1);
    expect(filterRfpsForChatgpt([rfp], "OT-2026")).toHaveLength(1);
    expect(filterRfpsForChatgpt([rfp], "renewal")).toHaveLength(1);
    expect(filterRfpsForChatgpt([rfp], "priority")).toHaveLength(1);
    expect(filterRfpsForChatgpt([rfp], "missing")).toHaveLength(0);
  });

  it("paginates RFPs for ChatGPT with a bounded default page size", () => {
    const rfps = Array.from({ length: 35 }, (_, index) => ({ ...rfp, id: `rfp-${index}` }));

    const page = paginateRfpsForChatgpt(rfps, { offset: 10, limit: 50 });

    expect(page.rfps).toHaveLength(25);
    expect(page.total).toBe(35);
    expect(page.offset).toBe(10);
    expect(page.limit).toBe(25);
    expect(page.has_more).toBe(false);
    expect(page.next_offset).toBeNull();
  });

  it("keeps source file metadata when signed URL creation fails", async () => {
    const [sourceFile] = await toSourceFileSummaries(
      [
        {
          id: "file-1",
          rfp_id: "rfp-1",
          kind: "source",
          title: "Spec",
          original_filename: "spec.pdf",
          mime_type: "application/pdf",
          storage_path: "missing/spec.pdf",
          file_size_bytes: 123,
          status: "Converted",
          notes: null,
          created_by: "ChatGPT",
          created_at: "2026-06-01T00:00:00.000Z",
        },
      ],
      async () => {
        throw new Error("Storage object not found");
      },
    );

    expect(sourceFile.download_url).toBeNull();
    expect(sourceFile.download_error).toBe("Storage object not found");
  });
});
