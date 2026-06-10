import { cleanConvertedMarkdown } from "@/lib/document-markdown-cleanup";
import {
  getAllowedFileSourceType,
  htmlToMarkdown,
  normalizeXlsxInlineStrings,
  parseCsv,
  sheetRowsToMarkdown,
  type ConversionResult,
} from "@/lib/document-conversion-core";

async function convertDocxBuffer(buffer: ArrayBuffer): Promise<string> {
  const mammoth = await import("mammoth");
  const result = await mammoth.convertToHtml({ buffer: Buffer.from(buffer) });
  return htmlToMarkdown(result.value);
}

async function convertPdfBuffer(arrayBuffer: ArrayBuffer): Promise<string> {
  const pdfjs = await import("pdfjs-dist");
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;
  const pages: string[] = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    const text = content.items.map((item) => ("str" in item ? item.str : "")).join(" ");
    pages.push(`## Page ${pageNumber}\n\n${text.trim()}`);
  }

  return cleanConvertedMarkdown(pages.join("\n\n"));
}

export async function convertBufferToMarkdown({
  buffer,
  filename,
}: {
  buffer: ArrayBuffer;
  filename: string;
}): Promise<ConversionResult> {
  const sourceType = getAllowedFileSourceType(filename);

  if (sourceType === "docx") {
    return { markdown: await convertDocxBuffer(buffer), sourceType };
  }

  if (sourceType === "pdf") {
    return { markdown: await convertPdfBuffer(buffer), sourceType };
  }

  if (sourceType === "csv") {
    const text = new TextDecoder().decode(buffer);
    return {
      markdown: sheetRowsToMarkdown(filename.replace(/\.[^.]+$/, "") || "CSV", parseCsv(text)),
      sourceType,
    };
  }

  if (sourceType === "xlsx") {
    const { default: readXlsxFile } = await import("read-excel-file/browser");
    const sheets = await readXlsxFile(await normalizeXlsxInlineStrings(buffer));
    return { markdown: sheets.map(({ sheet, data }) => sheetRowsToMarkdown(sheet, data)).join("\n\n"), sourceType };
  }

  return { markdown: cleanConvertedMarkdown(new TextDecoder().decode(buffer)), sourceType: "markdown" };
}
