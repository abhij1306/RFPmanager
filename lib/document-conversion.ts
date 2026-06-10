import { cleanConvertedMarkdown } from "@/lib/document-markdown-cleanup";
import {
  getAllowedFileSourceType,
  htmlToMarkdown,
  normalizeXlsxInlineStrings,
  parseCsv,
  sheetRowsToMarkdown,
  type ConversionResult,
} from "@/lib/document-conversion-core";

async function convertDocx(file: File): Promise<string> {
  const mammoth = await import("mammoth/mammoth.browser");
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.convertToHtml({ arrayBuffer });
  return htmlToMarkdown(result.value);
}

async function convertPdf(file: File): Promise<string> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
  const pages: string[] = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    const text = content.items.map((item) => ("str" in item ? item.str : "")).join(" ");
    pages.push(`## Page ${pageNumber}\n\n${text.trim()}`);
  }

  return cleanConvertedMarkdown(pages.join("\n\n"));
}

async function convertSpreadsheet(file: File, extension: "xlsx" | "csv"): Promise<string> {
  if (extension === "csv") {
    return sheetRowsToMarkdown(file.name.replace(/\.[^.]+$/, "") || "CSV", parseCsv(await file.text()));
  }

  const { default: readXlsxFile } = await import("read-excel-file/browser");
  const sheets = await readXlsxFile(await normalizeXlsxInlineStrings(await file.arrayBuffer()));
  return sheets.map(({ sheet, data }) => sheetRowsToMarkdown(sheet, data)).join("\n\n");
}

export async function convertFile(file: File): Promise<ConversionResult> {
  const sourceType = getAllowedFileSourceType(file.name);

  if (sourceType === "docx") {
    return { markdown: await convertDocx(file), sourceType };
  }

  if (sourceType === "pdf") {
    return { markdown: await convertPdf(file), sourceType };
  }

  if (sourceType === "xlsx" || sourceType === "csv") {
    return { markdown: await convertSpreadsheet(file, sourceType), sourceType };
  }

  return { markdown: cleanConvertedMarkdown(await file.text()), sourceType: "markdown" };
}

export {
  getAllowedFileSourceType,
  normalizeXlsxInlineStrings,
  parseCsv,
  sheetRowsToMarkdown,
  type ConversionResult,
} from "@/lib/document-conversion-core";
