"use client";

import { useRef, useState } from "react";
import TurndownService from "turndown";
import "./doc-converter.css";

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

async function convertFile(file: File): Promise<string> {
  const extension = file.name.split(".").pop()?.toLowerCase();

  if (extension === "docx") {
    return convertDocx(file);
  }

  if (extension === "pdf") {
    return convertPdf(file);
  }

  throw new Error("Upload a DOCX or PDF file.");
}

export function DocConverter() {
  const [markdown, setMarkdown] = useState("");
  const [fileName, setFileName] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [isConverting, setIsConverting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFiles(files: FileList | null) {
    const file = files?.[0];
    if (!file) {
      return;
    }

    setMessage(null);
    setIsConverting(true);
    setFileName(file.name);

    try {
      setMarkdown(await convertFile(file));
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

  return (
    <div className="converter-grid">
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
          accept=".docx,.pdf,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          hidden
          onChange={(event) => void handleFiles(event.target.files)}
          ref={inputRef}
          type="file"
        />
        <span className="drop-kicker">DOCX / PDF</span>
        <h2>{isConverting ? "Converting..." : "Drop an RFP document"}</h2>
        <p>{fileName || "Choose a file or drag it here. Conversion runs locally and nothing is stored."}</p>
        <button className="button" type="button">
          Select File
        </button>
      </section>

      <section className="panel preview-panel">
        <div className="preview-header">
          <div>
            <span className="drop-kicker">Markdown Preview</span>
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
      </section>
    </div>
  );
}
