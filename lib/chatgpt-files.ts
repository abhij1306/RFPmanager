import type { RfpDocumentSourceType } from "@/lib/types";

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

export type OpenAiFileRef = {
  id: string;
  name: string;
  mimeType: string | null;
  downloadLink: string;
};

type RawOpenAiFileRef = {
  id?: unknown;
  file_id?: unknown;
  fileId?: unknown;
  name?: unknown;
  filename?: unknown;
  file_name?: unknown;
  title?: unknown;
  mime_type?: unknown;
  mimeType?: unknown;
  download_link?: unknown;
  downloadLink?: unknown;
  download_url?: unknown;
  url?: unknown;
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
    const id = firstString(ref.id, ref.file_id, ref.fileId);
    const name = firstString(ref.name, ref.filename, ref.file_name, ref.title);
    const mimeType = firstString(ref.mime_type, ref.mimeType);
    const downloadLink = firstString(ref.download_link, ref.downloadLink, ref.download_url, ref.url);

    if (!id || !name || !downloadLink) {
      throw new Error(`openaiFileIdRefs[${index}] must include a file id, name, and download link.`);
    }

    return {
      id,
      name,
      mimeType: mimeType || null,
      downloadLink,
    };
  });
}

function firstString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return null;
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
    throw new ValidationError("title is required.");
  }

  if (typeof draft.content !== "string" || !draft.content.trim()) {
    throw new ValidationError("content is required.");
  }

  return {
    title: draft.title.trim(),
    content: draft.content.trim(),
  };
}
