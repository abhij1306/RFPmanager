import TurndownService from "turndown";
import { getAllowedFileSourceType } from "@/lib/chatgpt-files";
import { cleanConvertedMarkdown, removeHtmlImages } from "@/lib/document-markdown-cleanup";
import type { RfpDocumentSourceType } from "@/lib/types";

export type ConversionResult = {
  markdown: string;
  sourceType: RfpDocumentSourceType;
};

function markdownEscape(value: unknown): string {
  return String(value ?? "")
    .replace(/\|/g, "\\|")
    .replace(/\r?\n/g, " ")
    .trim();
}

export function sheetRowsToMarkdown(sheetName: string, rows: unknown[][]): string {
  const populatedRows = rows
    .map((row) => row.map(markdownEscape))
    .filter((row) => row.some((cell) => cell.length > 0));

  if (populatedRows.length === 0) {
    return `## ${sheetName}\n\n_No rows found._`;
  }

  const columnCount = Math.max(...populatedRows.map((row) => row.length));
  const normalizedRows = populatedRows.map((row) => Array.from({ length: columnCount }, (_, index) => row[index] ?? ""));
  const [firstRow, ...bodyRows] = normalizedRows;
  const header = firstRow;
  const separator = header.map(() => "---");
  const body = bodyRows.length ? bodyRows : [Array.from({ length: columnCount }, () => "")];

  return [
    `## ${sheetName}`,
    "",
    `| ${header.join(" | ")} |`,
    `| ${separator.join(" | ")} |`,
    ...body.map((row) => `| ${row.join(" | ")} |`),
  ].join("\n");
}

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const nextChar = text[index + 1];

    if (char === '"' && inQuotes && nextChar === '"') {
      cell += '"';
      index += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      row.push(cell);
      cell = "";
    } else if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && nextChar === "\n") {
        index += 1;
      }
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }

  row.push(cell);
  rows.push(row);

  return rows;
}

function htmlToMarkdown(html: string): string {
  const turndown = new TurndownService({ headingStyle: "atx", codeBlockStyle: "fenced" });
  turndown.remove("img");
  return cleanConvertedMarkdown(turndown.turndown(removeHtmlImages(html)));
}

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
  const sheets = await readXlsxFile(file);
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

  if (sourceType === "markdown") {
    return { markdown: cleanConvertedMarkdown(await file.text()), sourceType: "markdown" };
  }

  throw new Error("Upload a DOCX, PDF, XLSX, CSV, MD, Markdown, or TXT file.");
}
