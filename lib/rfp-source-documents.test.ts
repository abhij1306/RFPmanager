import { afterEach, describe, expect, it, vi } from "vitest";
import { convertFile } from "@/lib/document-conversion";
import { createDocument } from "@/lib/documents";
import { PartialUploadError } from "@/lib/errors";
import { uploadRfpFile } from "@/lib/rfp-files";
import { uploadSourceDocuments } from "@/lib/rfp-source-documents";

vi.mock("@/lib/document-conversion", () => ({ convertFile: vi.fn() }));
vi.mock("@/lib/documents", () => ({ createDocument: vi.fn() }));
vi.mock("@/lib/rfp-files", () => ({ uploadRfpFile: vi.fn() }));

const convertFileMock = vi.mocked(convertFile);
const createDocumentMock = vi.mocked(createDocument);
const uploadRfpFileMock = vi.mocked(uploadRfpFile);

describe("browser RFP source documents", () => {
  afterEach(() => vi.clearAllMocks());

  it("reports records completed before a later file fails", async () => {
    const firstFile = new File(["first"], "first.md", { type: "text/markdown" });
    const secondFile = new File(["second"], "second.md", { type: "text/markdown" });

    convertFileMock
      .mockResolvedValueOnce({ markdown: "# First", sourceType: "markdown" })
      .mockRejectedValueOnce({ message: "Conversion failed" });
    uploadRfpFileMock.mockResolvedValue({
      id: "file-1",
      rfp_id: "rfp-1",
      kind: "source",
      title: "first",
      original_filename: "first.md",
      mime_type: "text/markdown",
      storage_path: "rfp-1/source/file-1.md",
      file_size_bytes: 5,
      status: "Converted",
      notes: null,
      created_by: "Team",
      created_at: "2026-08-10T00:00:00.000Z",
    });
    createDocumentMock.mockResolvedValue({
      id: "document-1",
      rfp_id: "rfp-1",
      source_file_id: "file-1",
      title: "first",
      source_filename: "first.md",
      source_type: "markdown",
      markdown: "# First",
      created_at: "2026-08-10T00:00:00.000Z",
    });

    const upload = uploadSourceDocuments({ files: [firstFile, secondFile], rfpId: "rfp-1" });

    await expect(upload).rejects.toMatchObject({
      completed: [{ document: { id: "document-1" }, sourceFile: { id: "file-1" } }],
      message: "Saved 1/2 source documents before second.md failed: Conversion failed",
      name: "PartialUploadError",
    } satisfies Partial<PartialUploadError<unknown>>);
  });
});
