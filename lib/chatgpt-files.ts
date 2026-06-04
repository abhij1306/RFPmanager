import type { RfpDocumentSourceType } from "@/lib/types";

export type OpenAiFileRef = {
  id: string;
  name: string;
  mimeType: string | null;
  downloadLink: string;
};

type RawOpenAiFileRef = {
  id?: unknown;
  name?: unknown;
  mime_type?: unknown;
  download_link?: unknown;
};

export function getAllowedFileSourceType(filename: string): RfpDocumentSourceType {
  const extension = filename.split(".").pop()?.toLowerCase();

  if (extension === "docx" || extension === "pdf" || extension === "xlsx" || extension === "csv") {
    return extension;
  }

  if (extension === "md" || extension === "markdown" || extension === "txt") {
    return "markdown";
  }

  if (extension === "xls") {
    throw new Error("Legacy XLS files are not supported. Save the spreadsheet as XLSX or CSV first.");
  }

  throw new Error("Upload a DOCX, PDF, XLSX, CSV, MD, Markdown, or TXT file.");
}

export function normalizeOpenAiFileRefs(payload: unknown): OpenAiFileRef[] {
  const refs = (payload as { openaiFileIdRefs?: unknown })?.openaiFileIdRefs;

  if (!Array.isArray(refs) || refs.length === 0) {
    throw new Error("openaiFileIdRefs must include at least one file.");
  }

  if (refs.length > 10) {
    throw new Error("openaiFileIdRefs can include at most 10 files.");
  }

  return refs.map((item, index) => {
    const ref = item as RawOpenAiFileRef;

    if (
      typeof ref.id !== "string" ||
      typeof ref.name !== "string" ||
      typeof ref.download_link !== "string" ||
      !ref.id.trim() ||
      !ref.name.trim() ||
      !ref.download_link.trim()
    ) {
      throw new Error(`openaiFileIdRefs[${index}] must include id, name, and download_link.`);
    }

    return {
      id: ref.id.trim(),
      name: ref.name.trim(),
      mimeType: typeof ref.mime_type === "string" && ref.mime_type.trim() ? ref.mime_type.trim() : null,
      downloadLink: ref.download_link.trim(),
    };
  });
}

export function validateSummaryInput(payload: unknown): string {
  const summary = (payload as { summary?: unknown })?.summary;

  if (typeof summary !== "string" || !summary.trim()) {
    throw new Error("summary is required.");
  }

  return summary.trim();
}

export function validateResponseDraftInput(payload: unknown): { title: string; content: string } {
  const draft = payload as { title?: unknown; content?: unknown };

  if (typeof draft.title !== "string" || !draft.title.trim()) {
    throw new Error("title is required.");
  }

  if (typeof draft.content !== "string" || !draft.content.trim()) {
    throw new Error("content is required.");
  }

  return {
    title: draft.title.trim(),
    content: draft.content.trim(),
  };
}
