import { afterEach, describe, expect, it, vi } from "vitest";
import { convertBufferToMarkdown } from "@/lib/document-conversion-server";
import { createDocument } from "@/lib/documents";
import { deleteRfpFile, uploadRfpFile } from "@/lib/rfp-files";
import { uploadRemoteSourceDocuments } from "@/lib/rfp-source-documents-server";

vi.mock("@/lib/document-conversion-server", () => ({
  convertBufferToMarkdown: vi.fn(),
}));

vi.mock("@/lib/documents", () => ({
  createDocument: vi.fn(),
}));

vi.mock("@/lib/rfp-files", () => ({
  deleteRfpFile: vi.fn(),
  uploadRfpFile: vi.fn(),
}));

const convertBufferToMarkdownMock = vi.mocked(convertBufferToMarkdown);
const createDocumentMock = vi.mocked(createDocument);
const uploadRfpFileMock = vi.mocked(uploadRfpFile);
const deleteRfpFileMock = vi.mocked(deleteRfpFile);

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

  it("removes the stored original when conversion fails, so no source file is left without Markdown", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("bytes")));
    const storedFile = { id: "file-9", storage_path: "rfp-1/source/file-9.pdf" } as never;
    uploadRfpFileMock.mockResolvedValue(storedFile);
    convertBufferToMarkdownMock.mockRejectedValue(new Error("Scanned PDF needs OCR"));
    deleteRfpFileMock.mockResolvedValue(undefined);

    await expect(
      uploadRemoteSourceDocuments({
        refs: [{ downloadLink: "https://files.example.test/scan.pdf", mimeType: "application/pdf", name: "Scan.pdf" }],
        rfpId: "rfp-1",
      }),
    ).rejects.toThrow("Saved 0/1 source documents before Scan.pdf failed: Scanned PDF needs OCR");

    expect(deleteRfpFileMock).toHaveBeenCalledWith(storedFile);
    expect(createDocumentMock).not.toHaveBeenCalled();
  });

  it("keeps input order and reports what was saved when a later file fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockImplementation(async () => new Response("bytes")));
    convertBufferToMarkdownMock.mockImplementation(async ({ filename }) => {
      if (filename === "c.pdf") throw new Error("bad file");
      return { markdown: `# ${filename}`, sourceType: "pdf" };
    });
    uploadRfpFileMock.mockImplementation(async ({ originalFilename }) => ({ id: `file-${originalFilename}` }) as never);
    createDocumentMock.mockImplementation(async (input) => ({ id: `doc-${input.source_filename}` }) as never);
    deleteRfpFileMock.mockResolvedValue(undefined);
    const refs = ["a.pdf", "b.pdf", "c.pdf"].map((name) => ({ downloadLink: `https://f.test/${name}`, mimeType: null, name }));

    const error = await uploadRemoteSourceDocuments({ refs, rfpId: "rfp-1" }).catch((caught) => caught);

    expect(error.message).toBe("Saved 2/3 source documents before c.pdf failed: bad file");
    expect(error.completed.map((item: { document: { id: string } }) => item.document.id)).toEqual(["doc-a.pdf", "doc-b.pdf"]);
    expect(deleteRfpFileMock).toHaveBeenCalledWith({ id: "file-c.pdf" });
  });
});
