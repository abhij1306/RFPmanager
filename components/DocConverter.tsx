"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { convertFile } from "@/lib/document-conversion";
import { createDocument, deleteDocument } from "@/lib/documents";
import { getErrorMessage } from "@/lib/errors";
import { uploadRfpFile } from "@/lib/rfp-files";
import type { Rfp, RfpDocument, RfpDocumentSourceType } from "@/lib/types";
import "./doc-converter.css";

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export function DocConverter({
  documentTotalCount,
  documents,
  page,
  pageSize,
  rfps,
}: {
  documentTotalCount: number;
  documents: RfpDocument[];
  page: number;
  pageSize: number;
  rfps: Rfp[];
}) {
  const [savedDocuments, setSavedDocuments] = useState(documents);
  const [savedTotalCount, setSavedTotalCount] = useState(documentTotalCount);
  const [markdown, setMarkdown] = useState("");
  const [fileName, setFileName] = useState("");
  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [sourceType, setSourceType] = useState<RfpDocumentSourceType>("markdown");
  const [selectedRfpId, setSelectedRfpId] = useState(rfps[0]?.id ?? "");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [isConverting, setIsConverting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const rfpNames = useMemo(() => new Map(rfps.map((rfp) => [rfp.id, rfp.client_name])), [rfps]);
  const totalPages = Math.max(1, Math.ceil(savedTotalCount / pageSize));

  async function handleFiles(files: FileList | null) {
    const file = files?.[0];
    if (!file) {
      return;
    }

    setMessage(null);
    setIsConverting(true);
    setFileName(file.name);
    setSourceFile(file);
    setTitle(file.name.replace(/\.[^.]+$/, ""));

    try {
      const result = await convertFile(file);
      setMarkdown(result.markdown);
      setSourceType(result.sourceType);
      setMessage("Converted locally in your browser.");
    } catch (error) {
      setMarkdown("");
      setSourceFile(null);
      setMessage(getErrorMessage(error, "Could not convert this file."));
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
      let sourceFileId: string | null = null;

      if (sourceFile) {
        const savedSourceFile = await uploadRfpFile({
          body: sourceFile,
          kind: "source",
          mimeType: sourceFile.type || null,
          originalFilename: sourceFile.name,
          rfpId: selectedRfpId,
          status: "Converted",
          title: title.trim() || fileName || sourceFile.name,
        });
        sourceFileId = savedSourceFile.id;
      }

      const saved = await createDocument({
        rfp_id: selectedRfpId,
        source_file_id: sourceFileId,
        title: title.trim() || fileName || "Converted markdown",
        source_filename: fileName || null,
        source_type: sourceType,
        markdown,
      });
      setSavedDocuments((current) => [saved, ...current]);
      setSavedTotalCount((current) => current + 1);
      setSourceFile(null);
      setMessage("Markdown saved to the selected RFP.");
    } catch (error) {
      setMessage(getErrorMessage(error, "Could not save this markdown."));
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
      setSavedTotalCount((current) => Math.max(0, current - 1));
      setMessage("Saved markdown deleted.");
    } catch (error) {
      setMessage(getErrorMessage(error, "Could not delete this saved markdown."));
    }
  }

  function openDocument(document: RfpDocument) {
    setMarkdown(document.markdown);
    setSourceType(document.source_type);
    setTitle(document.title);
    setFileName(document.source_filename ?? "");
    setSourceFile(null);
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
          accept=".docx,.pdf,.xlsx,.csv,.md,.markdown,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv,text/markdown,text/plain"
          hidden
          onChange={(event) => void handleFiles(event.target.files)}
          ref={inputRef}
          type="file"
        />
        <span className="drop-kicker">DOCX / PDF / XLSX / CSV / MD</span>
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
            <p>{savedTotalCount} saved files across the RFP workspace.</p>
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
        {totalPages > 1 ? (
          <nav aria-label="Markdown library pages" className="library-pager">
            {page > 1 ? (
              <Link className="ghost-button compact-button" href={`/convert?page=${page - 1}`}>
                Previous
              </Link>
            ) : (
              <span className="ghost-button compact-button pager-disabled">Previous</span>
            )}
            <span className="pager-status">Page {page} of {totalPages}</span>
            {page < totalPages ? (
              <Link className="ghost-button compact-button" href={`/convert?page=${page + 1}`}>
                Next
              </Link>
            ) : (
              <span className="ghost-button compact-button pager-disabled">Next</span>
            )}
          </nav>
        ) : null}
      </section>
    </div>
  );
}
