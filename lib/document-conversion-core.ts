import type { RfpDocumentSourceType } from "@/lib/types";

export type ConversionResult = {
  markdown: string;
  sourceType: RfpDocumentSourceType;
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
