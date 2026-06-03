"use client";

import { useMemo, useRef, useState } from "react";
import TurndownService from "turndown";
import { createDocument, deleteDocument } from "@/lib/documents";
import type { Rfp, RfpDocument, RfpDocumentSourceType } from "@/lib/types";
import "./doc-converter.css";

type ConversionResult = {
  markdown: string;
  sourceType: RfpDocumentSourceType;
};

function markdownEscape(value: unknown): string {
  return String(value ?? "")
    .replace(/\|/g, "\\|")
    .replace(/\r?\n/g, " ")
    .trim();
}

function sheetRowsToMarkdown(sheetName: string, rows: unknown[][]): string {
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

function parseCsv(text: string): string[][] {
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

async function convertDocx(file: File): Promise<string> {
  const mammoth = await import("mammoth/mammoth.browser");
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.convertToHtml({ arrayBuffer });
  return new TurndownService({ headingStyle: "atx", codeBlockStyle: "fenced" }).turndown(result.value);
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

  return pages.join("\n\n");
}

async function convertSpreadsheet(file: File, extension: "xlsx" | "csv"): Promise<string> {
  if (extension === "csv") {
    return sheetRowsToMarkdown(file.name.replace(/\.[^.]+$/, "") || "CSV", parseCsv(await file.text()));
  }

  const { default: readXlsxFile } = await import("read-excel-file/browser");
  const sheets = await readXlsxFile(file);
  return sheets.map(({ sheet, data }) => sheetRowsToMarkdown(sheet, data)).join("\n\n");
}

async function convertFile(file: File): Promise<ConversionResult> {
  const extension = file.name.split(".").pop()?.toLowerCase();

  if (extension === "docx") {
    return { markdown: await convertDocx(file), sourceType: extension };
  }

  if (extension === "pdf") {
    return { markdown: await convertPdf(file), sourceType: extension };
  }

  if (extension === "xlsx" || extension === "csv") {
    return { markdown: await convertSpreadsheet(file, extension), sourceType: extension };
  }

  if (extension === "xls") {
    throw new Error("Legacy XLS files are not supported. Save the spreadsheet as XLSX or CSV first.");
  }

  throw new Error("Upload a DOCX, PDF, XLSX, or CSV file.");
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export function DocConverter({ documents, rfps }: { documents: RfpDocument[]; rfps: Rfp[] }) {
  const [savedDocuments, setSavedDocuments] = useState(documents);
  const [markdown, setMarkdown] = useState("");
  const [fileName, setFileName] = useState("");
  const [sourceType, setSourceType] = useState<RfpDocumentSourceType>("markdown");
  const [selectedRfpId, setSelectedRfpId] = useState(rfps[0]?.id ?? "");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [isConverting, setIsConverting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const rfpNames = useMemo(() => new Map(rfps.map((rfp) => [rfp.id, rfp.client_name])), [rfps]);

  async function handleFiles(files: FileList | null) {
    const file = files?.[0];
    if (!file) {
      return;
    }

    setMessage(null);
    setIsConverting(true);
    setFileName(file.name);
    setTitle(file.name.replace(/\.[^.]+$/, ""));

    try {
      const result = await convertFile(file);
      setMarkdown(result.markdown);
      setSourceType(result.sourceType);
      setMessage("Converted locally in your browser.");
    } catch (error) {
      setMarkdown("");
      setMessage(error instanceof Error ? error.message : "Could not convert this file.");
    } finally {
      setIsConverting(false);
    }
  }

  async function copyMarkdown() {
    if (!markdown) {
      return;
    }

    await navigator.clipboard.writeText(markdown);
    setMessage("Markdown copied to clipboard.");
  }

  async function saveMarkdown() {
    if (!markdown.trim() || !selectedRfpId) {
      setMessage("Choose an RFP and add markdown before saving.");
      return;
    }

    setIsSaving(true);
    setMessage(null);

    try {
      const saved = await createDocument({
        rfp_id: selectedRfpId,
        title: title.trim() || fileName || "Converted markdown",
        source_filename: fileName || null,
        source_type: sourceType,
        markdown,
      });
      setSavedDocuments((current) => [saved, ...current]);
      setMessage("Markdown saved to the selected RFP.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save this markdown.");
    } finally {
      setIsSaving(false);
    }
  }

  async function removeDocument(id: string) {
    if (!window.confirm("Delete this saved markdown?")) {
      return;
    }

    try {
      await deleteDocument(id);
      setSavedDocuments((current) => current.filter((document) => document.id !== id));
      setMessage("Saved markdown deleted.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not delete this saved markdown.");
    }
  }

  function openDocument(document: RfpDocument) {
    setMarkdown(document.markdown);
    setSourceType(document.source_type);
    setTitle(document.title);
    setFileName(document.source_filename ?? "");
    setSelectedRfpId(document.rfp_id);
    setMessage(null);
  }

  return (
    <div className="converter-workspace">
      <section
        className="drop-zone"
        onClick={() => inputRef.current?.click()}
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          void handleFiles(event.dataTransfer.files);
        }}
      >
        <input
          accept=".docx,.pdf,.xlsx,.csv,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
          hidden
          onChange={(event) => void handleFiles(event.target.files)}
          ref={inputRef}
          type="file"
        />
        <span className="drop-kicker">DOCX / PDF / XLSX / CSV</span>
        <h2>{isConverting ? "Converting..." : "Drop a source file"}</h2>
        <p>{fileName || "Choose a document or spreadsheet. Conversion runs locally before saving markdown."}</p>
        <button className="button" type="button">
          Select File
        </button>
      </section>

      <section className="panel preview-panel">
        <div className="preview-header">
          <div>
            <span className="drop-kicker">Markdown</span>
            <h2>Converted Output</h2>
          </div>
          <button className="ghost-button" disabled={!markdown} onClick={() => void copyMarkdown()} type="button">
            Copy
          </button>
        </div>
        {message ? <div className="notice">{message}</div> : null}
        <textarea
          aria-label="Markdown preview"
          className="markdown-preview"
          onChange={(event) => setMarkdown(event.target.value)}
          placeholder="Converted Markdown appears here."
          value={markdown}
        />
        <div className="save-strip">
          <input
            className="input"
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Markdown title"
            value={title}
          />
          <select className="select" onChange={(event) => setSelectedRfpId(event.target.value)} value={selectedRfpId}>
            <option value="">Select RFP</option>
            {rfps.map((rfp) => (
              <option key={rfp.id} value={rfp.id}>
                {rfp.client_name}
              </option>
            ))}
          </select>
          <button className="button" disabled={!markdown || !selectedRfpId || isSaving} onClick={() => void saveMarkdown()} type="button">
            {isSaving ? "Saving..." : "Save to RFP"}
          </button>
        </div>
      </section>

      <section className="documents-panel">
        <div className="section-heading">
          <div>
            <h2>Markdown Library</h2>
            <p>{savedDocuments.length} saved files across the RFP workspace.</p>
          </div>
        </div>
        <div className="document-list">
          {savedDocuments.map((document) => (
            <article className="document-row" key={document.id}>
              <div className="file-icon">MD</div>
              <div className="document-main">
                <div className="document-title">{document.title}</div>
                <div className="document-meta">
                  {rfpNames.get(document.rfp_id) ?? "Unknown RFP"} · {document.source_type.toUpperCase()} · {formatDate(document.created_at)}
                </div>
              </div>
              <button className="ghost-button compact-button" onClick={() => openDocument(document)} type="button">
                Open
              </button>
              <button className="ghost-button compact-button" onClick={() => void removeDocument(document.id)} type="button">
                Delete
              </button>
            </article>
          ))}
          {savedDocuments.length === 0 ? <div className="empty-library">Saved markdown files will appear here.</div> : null}
        </div>
      </section>
    </div>
  );
}
