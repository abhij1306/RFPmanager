import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
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

type XmlTools = {
  parse(xml: string): Document;
  serialize(document: Document): string;
};

async function getXmlTools(): Promise<XmlTools> {
  if (typeof DOMParser !== "undefined" && typeof XMLSerializer !== "undefined") {
    return {
      parse: (xml) => new DOMParser().parseFromString(xml, "application/xml"),
      serialize: (document) => new XMLSerializer().serializeToString(document),
    };
  }

  const { DOMParser: XmldomParser, XMLSerializer: XmldomSerializer } = await import("@xmldom/xmldom");
  const serializer = new XmldomSerializer() as { serializeToString(document: unknown): string };

  return {
    parse: (xml) => new XmldomParser().parseFromString(xml, "application/xml") as unknown as Document,
    serialize: (document) => serializer.serializeToString(document),
  };
}

function getLocalName(node: Node): string {
  const localName = (node as { localName?: string }).localName;
  if (localName) {
    return localName;
  }

  const nodeName = (node as { nodeName?: string }).nodeName;
  if (nodeName) {
    return nodeName.replace(/^.*:/, "");
  }

  return "";
}

function getElementChildren(element: Element): Element[] {
  const children: Element[] = [];

  for (let index = 0; index < element.childNodes.length; index += 1) {
    const child = element.childNodes.item(index);
    if (child.nodeType === 1) {
      children.push(child as Element);
    }
  }

  return children;
}

function getTextFromElement(element: Element): string {
  if (getLocalName(element) === "t") {
    return element.textContent ?? "";
  }

  return getElementChildren(element)
    .map((child) => getTextFromElement(child))
    .join("");
}

function getAllElements(document: Document): Element[] {
  const elements = document.getElementsByTagName("*");
  return Array.from({ length: elements.length }, (_, index) => elements.item(index)).filter(
    (element): element is Element => Boolean(element),
  );
}

function wrapUnsupportedInlineStringRuns(xml: string, xmlTools: XmlTools): string {
  const document = xmlTools.parse(xml);
  let changed = false;

  for (const cell of getAllElements(document)) {
    if (getLocalName(cell) !== "c" || cell.getAttribute("t") !== "inlineStr") {
      continue;
    }

    const elementChildren = getElementChildren(cell);
    const inlineString = elementChildren.find((child) => getLocalName(child) === "is");

    if (inlineString) {
      const [firstInlineChild] = getElementChildren(inlineString);
      if (firstInlineChild && getLocalName(firstInlineChild) === "t") {
        continue;
      }

      const textElement = document.createElement("t");
      textElement.appendChild(document.createTextNode(getTextFromElement(inlineString)));

      while (inlineString.firstChild) {
        inlineString.removeChild(inlineString.firstChild);
      }
      inlineString.appendChild(textElement);
      changed = true;
      continue;
    }

    const inlineChildren = elementChildren.filter((child) =>
      ["r", "t", "rPh", "phoneticPr"].includes(getLocalName(child)),
    );

    if (inlineChildren.length === 0) {
      continue;
    }

    const normalizedInlineString = cell.namespaceURI
      ? document.createElementNS(cell.namespaceURI, "is")
      : document.createElement("is");
    const textElement = document.createElement("t");
    textElement.appendChild(document.createTextNode(inlineChildren.map((child) => getTextFromElement(child)).join("")));

    normalizedInlineString.appendChild(textElement);
    cell.insertBefore(normalizedInlineString, inlineChildren[0]);
    for (const child of inlineChildren) {
      cell.removeChild(child);
    }
    changed = true;
  }

  return changed ? xmlTools.serialize(document) : xml;
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

export async function normalizeXlsxInlineStrings(arrayBuffer: ArrayBuffer): Promise<ArrayBuffer> {
  const archive = unzipSync(new Uint8Array(arrayBuffer));
  const xmlTools = await getXmlTools();
  let changed = false;

  for (const [path, bytes] of Object.entries(archive)) {
    if (!/^xl\/worksheets\/.+\.xml$/i.test(path)) {
      continue;
    }

    const xml = strFromU8(bytes);
    if (!xml.includes("inlineStr")) {
      continue;
    }

    const normalizedXml = wrapUnsupportedInlineStringRuns(xml, xmlTools);
    if (normalizedXml !== xml) {
      archive[path] = strToU8(normalizedXml);
      changed = true;
    }
  }

  return changed ? toArrayBuffer(zipSync(archive)) : arrayBuffer;
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

  if (sourceType === "markdown") {
    return { markdown: cleanConvertedMarkdown(await file.text()), sourceType: "markdown" };
  }

  throw new Error("Upload a DOCX, PDF, XLSX, CSV, MD, Markdown, or TXT file.");
}
