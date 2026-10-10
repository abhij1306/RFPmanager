"use client";

import { Copy, Trash2, UploadCloud } from "lucide-react";
import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { confirmAction, toast } from "@/components/ui/feedback";
import { convertFile } from "@/lib/document-conversion";
import { displayTitle, formatRelativeTime } from "@/lib/display";
import { createDocument, deleteDocument } from "@/lib/documents";
import { getErrorMessage } from "@/lib/errors";
import { FILE_ACCEPT, FILE_TYPES_LABEL } from "@/lib/file-accept";
import { deleteRfpFile, uploadRfpFile } from "@/lib/rfp-files";
import type { RfpOption } from "@/lib/rfp-queries";
import type { RfpDocument, RfpDocumentSourceType, RfpFile } from "@/lib/types";

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
  rfps: RfpOption[];
}) {
  const [savedDocuments, setSavedDocuments] = useState(documents);
  const [savedTotalCount, setSavedTotalCount] = useState(documentTotalCount);
  const [markdown, setMarkdown] = useState("");
  const [fileName, setFileName] = useState("");
  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [sourceType, setSourceType] = useState<RfpDocumentSourceType>("markdown");
  const [selectedRfpId, setSelectedRfpId] = useState("");
  const [title, setTitle] = useState("");
  const [isConverting, setIsConverting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const rfpNames = useMemo(() => new Map(rfps.map((rfp) => [rfp.id, displayTitle(rfp.client_name)])), [rfps]);
  const totalPages = Math.max(1, Math.ceil(savedTotalCount / pageSize));

  async function handleFiles(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    setIsConverting(true);
    setFileName(file.name);
    setSourceFile(file);
    setTitle(file.name.replace(/\.[^.]+$/, ""));
    try {
      const result = await convertFile(file);
      setMarkdown(result.markdown);
      setSourceType(result.sourceType);
    } catch (error) {
      setMarkdown("");
      setSourceFile(null);
      toast(getErrorMessage(error, "Could not convert this file."), "error");
    } finally {
      setIsConverting(false);
    }
  }

  async function save() {
    if (!markdown.trim() || !selectedRfpId) return;
    setIsSaving(true);
    let savedFile: RfpFile | null = null;
    try {
      let sourceFileId: string | null = null;
      if (sourceFile) {
        savedFile = await uploadRfpFile({
          body: sourceFile,
          kind: "source",
          mimeType: sourceFile.type || null,
          originalFilename: sourceFile.name,
          rfpId: selectedRfpId,
          status: "Converted",
          title: title.trim() || fileName || sourceFile.name,
        });
        sourceFileId = savedFile.id;
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
      setMarkdown("");
      setFileName("");
      setTitle("");
      toast(`Saved to ${rfpNames.get(selectedRfpId) ?? "the RFP"}`);
    } catch (error) {
      // Never leave an original without its converted document.
      if (savedFile) await deleteRfpFile(savedFile).catch(() => undefined);
      toast(getErrorMessage(error, "Could not save this document."), "error");
    } finally {
      setIsSaving(false);
    }
  }

  async function remove(document: RfpDocument) {
    const confirmed = await confirmAction({ title: "Delete this Markdown?", body: `“${document.title}” will no longer be available to MCP agents.`, confirmLabel: "Delete", tone: "danger" });
    if (!confirmed) return;
    try {
      await deleteDocument(document.id);
      setSavedDocuments((current) => current.filter((item) => item.id !== document.id));
      setSavedTotalCount((current) => Math.max(0, current - 1));
      toast("Markdown deleted");
    } catch (error) {
      toast(getErrorMessage(error, "Could not delete this Markdown."), "error");
    }
  }

  return (
    <div className="stack" style={{ gap: 24 }}>
      <div className="converter">
        <div className="panel">
          <div className="panel-header"><div><h2>Source file</h2><p>Converted in your browser; nothing is saved until you choose an RFP</p></div></div>
          <div className="panel-body stack">
            <input accept={FILE_ACCEPT} hidden onChange={(event) => { void handleFiles(event.target.files); event.target.value = ""; }} ref={inputRef} type="file" />
            <button
              className="dropzone"
              data-dragging={dragging}
              onClick={() => inputRef.current?.click()}
              onDragLeave={() => setDragging(false)}
              onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
              onDrop={(event) => { event.preventDefault(); setDragging(false); void handleFiles(event.dataTransfer.files); }}
              type="button"
            >
              <span className="dropzone-icon"><UploadCloud size={18} /></span>
              <strong>{isConverting ? "Converting…" : fileName || "Drop a file to convert"}</strong>
              <span>{FILE_TYPES_LABEL}</span>
            </button>
            <div className="field">
              <label className="field-label" htmlFor="convert-title">Title</label>
              <input className="input" id="convert-title" onChange={(event) => setTitle(event.target.value)} placeholder="Document title" value={title} />
            </div>
            <div className="field">
              <label className="field-label" htmlFor="convert-rfp">Save to RFP</label>
              <select className="select" id="convert-rfp" onChange={(event) => setSelectedRfpId(event.target.value)} value={selectedRfpId}>
                <option value="">Choose an RFP…</option>
                {rfps.map((rfp) => <option key={rfp.id} value={rfp.id}>{displayTitle(rfp.client_name)}</option>)}
              </select>
            </div>
          </div>
          <div className="panel-footer">
            <button className="btn btn-primary" disabled={!markdown.trim() || !selectedRfpId || isSaving} onClick={() => void save()} type="button">{isSaving ? "Saving…" : "Save to RFP"}</button>
          </div>
        </div>
        <div className="panel">
          <div className="panel-header">
            <div><h2>Markdown</h2><p>{markdown ? `${markdown.length.toLocaleString()} characters · editable` : "Output appears here"}</p></div>
            <button className="btn btn-secondary btn-sm" disabled={!markdown} onClick={() => void navigator.clipboard.writeText(markdown).then(() => toast("Markdown copied"), () => toast("Could not copy", "error"))} type="button"><Copy size={14} />Copy</button>
          </div>
          <div className="panel-body">
            <textarea aria-label="Converted Markdown" className="textarea editor-textarea" onChange={(event) => setMarkdown(event.target.value)} placeholder="Converted Markdown appears here." value={markdown} />
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-header"><div><h2>All converted documents</h2><p>{savedTotalCount} documents across every RFP</p></div></div>
        <ul className="file-list" style={{ margin: 0, padding: "0 20px" }}>
          {savedDocuments.map((document) => (
            <li className="file-row" key={document.id}>
              <span className="file-badge">MD</span>
              <span className="file-main">
                <strong>{document.title}</strong>
                <span suppressHydrationWarning>
                  <Link href={`/rfp/${document.rfp_id}`} style={{ color: "var(--accent-text)" }}>{rfpNames.get(document.rfp_id) ?? "Unknown RFP"}</Link> · {formatRelativeTime(document.created_at)}
                </span>
              </span>
              <button aria-label={`Delete ${document.title}`} className="btn btn-ghost btn-sm btn-icon" onClick={() => void remove(document)} type="button"><Trash2 size={14} /></button>
            </li>
          ))}
          {savedDocuments.length === 0 ? <li className="palette-empty">No converted documents yet.</li> : null}
        </ul>
        {totalPages > 1 ? (
          <nav aria-label="Pages" className="pager">
            {page > 1 ? <Link className="btn btn-secondary btn-sm" href={`/convert?page=${page - 1}`}>Previous</Link> : <span />}
            <span className="tabular">Page {page} of {totalPages}</span>
            {page < totalPages ? <Link className="btn btn-secondary btn-sm" href={`/convert?page=${page + 1}`}>Next</Link> : <span />}
          </nav>
        ) : null}
      </div>
    </div>
  );
}
