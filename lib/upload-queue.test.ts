import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { RfpDocument, RfpFile } from "@/lib/types";

// The browser converter (Web Worker + WASM) and Supabase can't run under jsdom; everything else is real.
vi.mock("@/lib/document-conversion", async () => {
  const core = await import("@/lib/document-conversion-core");
  return {
    getAllowedFileSourceType: core.getAllowedFileSourceType,
    convertFile: vi.fn(async (file: File) => {
      if (file.name.startsWith("corrupt")) throw new Error("The document converter could not read the file.");
      return { markdown: `# ${file.name}`, sourceType: core.getAllowedFileSourceType(file.name) };
    }),
  };
});
const deleted: string[] = [];
vi.mock("@/lib/rfp-files", () => ({
  uploadRfpFile: vi.fn(async ({ originalFilename, rfpId }: { originalFilename: string; rfpId: string }): Promise<Partial<RfpFile>> => ({ id: `file-${originalFilename}`, rfp_id: rfpId, original_filename: originalFilename })),
  deleteRfpFile: vi.fn(async (file: RfpFile) => { deleted.push(file.id); }),
}));
vi.mock("@/lib/documents", () => ({
  createDocument: vi.fn(async (input: Omit<RfpDocument, "id" | "created_at">) => ({ ...input, id: `doc-${input.source_filename}`, created_at: "2026-10-10T00:00:00.000Z" })),
}));

const { enqueueUploads, useUploads } = await import("@/lib/upload-queue");

describe("upload queue", () => {
  it("converts and saves each file, and a failed file neither blocks the rest nor leaves its original behind", async () => {
    const { result } = renderHook(() => useUploads());

    enqueueUploads("rfp-1", [
      new File(["a"], "spec.pdf"),
      new File(["b"], "corrupt-annex.pdf"),
      new File(["c"], "pricing.xlsx"),
      new File(["d"], "legacy.xls"),
    ]);

    await waitFor(() => expect(result.current.every((item) => item.state.kind === "done" || item.state.kind === "failed")).toBe(true));

    const outcome = Object.fromEntries(result.current.map((item) => [
      item.file.name,
      item.state.kind === "done" ? `done:${item.state.document.id}:${item.state.document.markdown}` : item.state.kind === "failed" ? `failed:${item.state.message}` : item.state.kind,
    ]));
    expect(outcome).toEqual({
      "spec.pdf": "done:doc-spec.pdf:# spec.pdf",
      "corrupt-annex.pdf": "failed:The document converter could not read the file.",
      "pricing.xlsx": "done:doc-pricing.xlsx:# pricing.xlsx",
      "legacy.xls": "failed:Legacy XLS files are not supported. Save the spreadsheet as XLSX or CSV first.",
    });
    expect(deleted).toEqual(["file-corrupt-annex.pdf"]);
  });
});
