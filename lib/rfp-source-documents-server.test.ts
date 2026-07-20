import { afterEach, describe, expect, it, vi } from "vitest";
import { convertBufferToMarkdown } from "@/lib/document-conversion-server";
import { createDocument } from "@/lib/documents";
import { uploadRfpFile } from "@/lib/rfp-files";
import { uploadRemoteSourceDocuments } from "@/lib/rfp-source-documents-server";

vi.mock("@/lib/document-conversion-server", () => ({
  convertBufferToMarkdown: vi.fn(),
}));

vi.mock("@/lib/documents", () => ({
  createDocument: vi.fn(),
}));

vi.mock("@/lib/rfp-files", () => ({
  uploadRfpFile: vi.fn(),
}));

const convertBufferToMarkdownMock = vi.mocked(convertBufferToMarkdown);
const createDocumentMock = vi.mocked(createDocument);
const uploadRfpFileMock = vi.mocked(uploadRfpFile);

describe("remote RFP source documents", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("downloads, converts, saves the source file, and creates markdown", async () => {
    const sourceBody = "source pdf bytes";
    const progress = vi.fn();

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(sourceBody)));
    convertBufferToMarkdownMock.mockResolvedValue({
      markdown: "# Tender",
      sourceType: "pdf",
    });
    uploadRfpFileMock.mockResolvedValue({
      id: "file-1",
      rfp_id: "rfp-1",
      kind: "source",
      title: "Tender Document",
      original_filename: "Tender Document.pdf",
      mime_type: "application/pdf",
      storage_path: "rfp-1/source/file-1.pdf",
      file_size_bytes: sourceBody.length,
      status: "Converted",
      notes: null,
      created_by: "ChatGPT",
      created_at: "2026-06-10T00:00:00.000Z",
    });
    createDocumentMock.mockResolvedValue({
      id: "document-1",
      rfp_id: "rfp-1",
      source_file_id: "file-1",
      title: "Tender Document",
      source_filename: "Tender Document.pdf",
      source_type: "pdf",
      markdown: "# Tender",
      created_at: "2026-06-10T00:00:00.000Z",
    });

    const saved = await uploadRemoteSourceDocuments({
      onProgress: progress,
      refs: [
        {
          downloadLink: "https://files.example.test/tender.pdf",
          mimeType: "application/pdf",
          name: "Tender Document.pdf",
        },
      ],
      rfpId: "rfp-1",
    });

    expect(fetch).toHaveBeenCalledWith(
      "https://files.example.test/tender.pdf",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(convertBufferToMarkdownMock).toHaveBeenCalledWith({
      buffer: expect.any(ArrayBuffer),
      filename: "Tender Document.pdf",
    });
    expect(uploadRfpFileMock).toHaveBeenCalledWith({
      body: expect.any(ArrayBuffer),
      createdBy: "ChatGPT",
      kind: "source",
      mimeType: "application/pdf",
      originalFilename: "Tender Document.pdf",
      rfpId: "rfp-1",
      status: "Converted",
      title: "Tender Document",
    });
    expect(createDocumentMock).toHaveBeenCalledWith({
      rfp_id: "rfp-1",
      source_file_id: "file-1",
      title: "Tender Document",
      source_filename: "Tender Document.pdf",
      source_type: "pdf",
      markdown: "# Tender",
    });
    expect(progress).toHaveBeenCalledWith(1, 1, {
      downloadLink: "https://files.example.test/tender.pdf",
      mimeType: "application/pdf",
      name: "Tender Document.pdf",
    });
    expect(saved).toEqual([
      {
        document: expect.objectContaining({ id: "document-1" }),
        sourceFile: expect.objectContaining({ id: "file-1" }),
      },
    ]);
  });

  it("stops before conversion when the remote source cannot be downloaded", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 404, statusText: "Not Found" })));

    await expect(
      uploadRemoteSourceDocuments({
        refs: [
          {
            downloadLink: "https://files.example.test/missing.pdf",
            mimeType: "application/pdf",
            name: "Missing.pdf",
          },
        ],
        rfpId: "rfp-1",
      }),
    ).rejects.toThrow("Could not download OpenAI file: 404 Not Found");

    expect(convertBufferToMarkdownMock).not.toHaveBeenCalled();
    expect(uploadRfpFileMock).not.toHaveBeenCalled();
    expect(createDocumentMock).not.toHaveBeenCalled();
  });
});
