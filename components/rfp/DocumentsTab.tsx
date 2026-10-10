import { AlertCircle, Check, Copy, Download, FileText, Loader2, RotateCcw, Search, Trash2, UploadCloud } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { MarkdownView } from "@/components/MarkdownView";
import { confirmAction, toast } from "@/components/ui/feedback";
import { fileExtension, formatBytes, formatRelativeTime } from "@/lib/display";
import { deleteDocument } from "@/lib/documents";
import { getErrorMessage } from "@/lib/errors";
import { FILE_ACCEPT, FILE_TYPES_LABEL } from "@/lib/file-accept";
import { createRfpFileDownloadUrl, deleteRfpFile } from "@/lib/rfp-files";
import { dismissUploads, enqueueUploads, isUploadActive, retryUpload, useUploads, type UploadItem } from "@/lib/upload-queue";
import type { RfpDocument, RfpFile } from "@/lib/types";

type Entry =
  | { kind: "document"; key: string; document: RfpDocument; file: RfpFile | undefined }
  | { kind: "original"; key: string; file: RfpFile }
  | { kind: "upload"; key: string; upload: UploadItem };

function uniqueById<Item extends { id: string }>(items: Item[]): Item[] {
  const seen = new Set<string>();
  return items.filter((item) => (seen.has(item.id) ? false : (seen.add(item.id), true)));
}

function entryTitle(entry: Entry): string {
  if (entry.kind === "document") return entry.document.title;
  if (entry.kind === "original") return entry.file.title;
  return entry.upload.file.name;
}

function entryType(entry: Entry): string {
  if (entry.kind === "document") return entry.file ? fileExtension(entry.file.original_filename) : entry.document.source_type === "markdown" ? "MD" : entry.document.source_type.toUpperCase();
  if (entry.kind === "original") return fileExtension(entry.file.original_filename);
  return fileExtension(entry.upload.file.name);
}

function entryMeta(entry: Entry): string {
  if (entry.kind === "upload") return formatBytes(entry.upload.file.size) ?? "";
  const file = entry.kind === "document" ? entry.file : entry.file;
  const createdAt = entry.kind === "document" ? entry.document.created_at : entry.file.created_at;
  return [formatBytes(file?.file_size_bytes), formatRelativeTime(createdAt)].filter(Boolean).join(" · ");
}

function UploadStatus({ upload }: { upload: UploadItem }) {
  switch (upload.state.kind) {
    case "queued":
      return <span className="upload-status">Queued</span>;
    case "working":
      return <span className="upload-status"><Loader2 className="spin" size={13} />Converting</span>;
    case "done":
      return <span className="upload-status" data-kind="done"><Check size={13} />Saved</span>;
    case "failed":
      return <span className="upload-status" data-kind="failed"><AlertCircle size={13} />Failed</span>;
    default: {
      const exhaustive: never = upload.state;
      return exhaustive;
    }
  }
}

export function DocumentsTab({
  documentTotalCount,
  documents,
  files,
  onCountChange,
  rfpId,
}: {
  documentTotalCount: number;
  documents: RfpDocument[];
  files: RfpFile[];
  onCountChange: (count: number) => void;
  rfpId: string;
}) {
  const router = useRouter();
  const allUploads = useUploads();
  const uploads = useMemo(() => allUploads.filter((item) => item.rfpId === rfpId), [allUploads, rfpId]);
  const [deletedIds, setDeletedIds] = useState<ReadonlySet<string>>(() => new Set());
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [markdownById, setMarkdownById] = useState<Record<string, string>>({});
  const [loadErrorById, setLoadErrorById] = useState<Record<string, string>>({});
  const [dragDepth, setDragDepth] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const requestedRef = useRef(new Set<string>());

  // Finished uploads merge straight into the library; the server copy arrives on the next refresh.
  const doneUploads = uploads.flatMap((item) => (item.state.kind === "done" ? [item.state] : []));
  const allDocuments = useMemo(
    () => uniqueById([...doneUploads.map((item) => item.document), ...documents]).filter((document) => !deletedIds.has(document.id)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [documents, deletedIds, uploads],
  );
  const allFiles = useMemo(
    () => uniqueById([...doneUploads.map((item) => item.sourceFile), ...files]).filter((file) => !deletedIds.has(file.id)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [files, deletedIds, uploads],
  );

  const entries = useMemo<Entry[]>(() => {
    const filesById = new Map(allFiles.map((file) => [file.id, file]));
    const paired = new Set<string>();
    const converted: Entry[] = allDocuments.map((document) => {
      const file = document.source_file_id ? filesById.get(document.source_file_id) : undefined;
      if (file) paired.add(file.id);
      return { kind: "document", key: `document-${document.id}`, document, file };
    });
    const originals: Entry[] = allFiles
      .filter((file) => file.kind === "source" && !paired.has(file.id))
      .map((file) => ({ kind: "original", key: `file-${file.id}`, file }));
    return [...converted, ...originals];
  }, [allDocuments, allFiles]);

  const pending: Entry[] = uploads
    .filter((item) => item.state.kind !== "done")
    .map((upload) => ({ kind: "upload", key: `upload-${upload.id}`, upload }));

  const term = query.trim().toLowerCase();
  const visible = term ? entries.filter((entry) => `${entryTitle(entry)} ${entry.kind !== "upload" && entry.kind === "document" ? entry.document.source_filename ?? "" : ""}`.toLowerCase().includes(term)) : entries;
  const selected = entries.find((entry) => entry.key === selectedKey) ?? visible[0] ?? null;
  const loadedCount = documentTotalCount - documents.length + allDocuments.length;
  const activeUploads = uploads.filter(isUploadActive).length;
  const finishedUploads = uploads.filter((item) => !isUploadActive(item)).length;

  useEffect(() => {
    onCountChange(loadedCount);
  }, [loadedCount, onCountChange]);

  // When this RFP's uploads drain, pull fresh server data so other views (and back navigation) match.
  const hadActiveRef = useRef(false);
  useEffect(() => {
    if (activeUploads > 0) hadActiveRef.current = true;
    else if (hadActiveRef.current) {
      hadActiveRef.current = false;
      router.refresh();
    }
  }, [activeUploads, router]);

  // Load the selected document's Markdown on demand; bodies are never part of the page payload.
  const selectedDocument = selected?.kind === "document" ? selected.document : null;
  useEffect(() => {
    if (!selectedDocument || selectedDocument.markdown || requestedRef.current.has(selectedDocument.id)) return;
    const { id } = selectedDocument;
    requestedRef.current.add(id);
    fetch(`/api/rfp/${rfpId}/documents/${id}`)
      .then(async (response) => {
        const data: unknown = await response.json().catch(() => null);
        const markdown = data && typeof data === "object" && "document" in data && data.document && typeof data.document === "object" && "markdown" in data.document && typeof data.document.markdown === "string" ? data.document.markdown : null;
        if (!response.ok || markdown === null) throw new Error("Could not load this document.");
        setMarkdownById((current) => ({ ...current, [id]: markdown }));
      })
      .catch((error: unknown) => {
        requestedRef.current.delete(id);
        setLoadErrorById((current) => ({ ...current, [id]: getErrorMessage(error, "Could not load this document.") }));
      });
  }, [rfpId, selectedDocument]);

  function addFiles(list: FileList | null) {
    const picked = Array.from(list ?? []);
    if (picked.length) enqueueUploads(rfpId, picked);
  }

  async function download(file: RfpFile) {
    try {
      window.location.assign(await createRfpFileDownloadUrl(file));
    } catch (error) {
      toast(getErrorMessage(error, "Could not create a download link."), "error");
    }
  }

  async function remove(entry: Entry) {
    if (entry.kind === "upload") return;
    const confirmed = await confirmAction({
      title: "Delete this document?",
      body: `“${entryTitle(entry)}” and its original file will be removed. MCP agents will no longer see it.`,
      confirmLabel: "Delete",
      tone: "danger",
    });
    if (!confirmed) return;
    try {
      if (entry.kind === "document") await deleteDocument(entry.document.id);
      if (entry.file) await deleteRfpFile(entry.file);
      setDeletedIds((current) => new Set([...current, ...(entry.kind === "document" ? [entry.document.id] : []), ...(entry.file ? [entry.file.id] : [])]));
      setSelectedKey(null);
      toast("Document deleted");
    } catch (error) {
      toast(getErrorMessage(error, "Could not delete the document."), "error");
    }
  }

  function onLibraryKey(event: React.KeyboardEvent) {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    const index = selected ? visible.findIndex((entry) => entry.key === selected.key) : -1;
    const next = visible[Math.min(visible.length - 1, Math.max(0, index + (event.key === "ArrowDown" ? 1 : -1)))];
    if (next) {
      setSelectedKey(next.key);
      document.getElementById(`entry-${next.key}`)?.focus();
    }
  }

  const markdown = selectedDocument ? selectedDocument.markdown || markdownById[selectedDocument.id] : undefined;
  const selectedFile = selected && selected.kind !== "upload" ? selected.file : undefined;

  return (
    <div
      className="documents"
      onDragEnter={(event) => { if (event.dataTransfer.types.includes("Files")) setDragDepth((depth) => depth + 1); }}
      onDragLeave={() => setDragDepth((depth) => Math.max(0, depth - 1))}
      onDragOver={(event) => { if (event.dataTransfer.types.includes("Files")) event.preventDefault(); }}
      onDrop={(event) => { event.preventDefault(); setDragDepth(0); addFiles(event.dataTransfer.files); }}
    >
      {dragDepth > 0 ? (
        <div className="page-drop-overlay"><div><UploadCloud size={28} />Drop to upload and convert</div></div>
      ) : null}

      <aside aria-label="Document library" className="library">
        <div className="library-top">
          <input accept={FILE_ACCEPT} hidden multiple onChange={(event) => { addFiles(event.target.files); event.target.value = ""; }} ref={inputRef} type="file" />
          <button className="dropzone dropzone-compact" onClick={() => inputRef.current?.click()} type="button">
            <span className="dropzone-icon"><UploadCloud size={15} /></span>
            <span style={{ textAlign: "left" }}>
              <strong style={{ display: "block", fontSize: 13 }}>Drop files or browse</strong>
              <span>{FILE_TYPES_LABEL}</span>
            </span>
          </button>
          {entries.length > 6 ? (
            <label className="input-with-icon">
              <span className="sr-only">Filter documents</span>
              <Search size={14} />
              <input className="input" onChange={(event) => setQuery(event.target.value)} placeholder="Filter documents" type="search" value={query} />
            </label>
          ) : null}
        </div>

        <div className="library-list" onKeyDown={onLibraryKey}>
          {pending.length > 0 || finishedUploads > 0 ? (
            <>
              <div className="library-group-label">
                <span>Uploads {activeUploads > 0 ? `· ${finishedUploads}/${uploads.length}` : ""}</span>
                {activeUploads === 0 ? <button className="btn btn-ghost btn-sm" onClick={() => dismissUploads(rfpId)} type="button">Clear</button> : null}
              </div>
              {pending.map((entry) => entry.kind === "upload" ? (
                <div className="doc-item" key={entry.key} title={entry.upload.state.kind === "failed" ? entry.upload.state.message : undefined}>
                  <span className="file-badge" data-type={entryType(entry)}>{entryType(entry)}</span>
                  <span className="file-main">
                    <strong>{entry.upload.file.name}</strong>
                    <span>{entry.upload.state.kind === "failed" ? entry.upload.state.message : entryMeta(entry)}</span>
                  </span>
                  {entry.upload.state.kind === "failed" ? (
                    <button aria-label={`Retry ${entry.upload.file.name}`} className="btn btn-ghost btn-sm btn-icon" onClick={() => retryUpload(entry.upload.id)} type="button"><RotateCcw size={14} /></button>
                  ) : <UploadStatus upload={entry.upload} />}
                </div>
              ) : null)}
            </>
          ) : null}

          {entries.length > 0 ? <div className="library-group-label"><span>Tender documents</span><span className="tabular">{loadedCount}</span></div> : null}
          {visible.map((entry) => (
            <button
              aria-current={selected?.key === entry.key ? "true" : undefined}
              className="doc-item"
              id={`entry-${entry.key}`}
              key={entry.key}
              onClick={() => setSelectedKey(entry.key)}
              type="button"
            >
              <span className="file-badge" data-type={entryType(entry)}>{entryType(entry)}</span>
              <span className="file-main">
                <strong title={entryTitle(entry)}>{entryTitle(entry)}</strong>
                <span suppressHydrationWarning>{entry.kind === "original" ? "Original only · not converted" : entryMeta(entry)}</span>
              </span>
            </button>
          ))}
          {entries.length > 0 && visible.length === 0 ? <p className="palette-empty">No documents match “{query}”.</p> : null}
          {entries.length === 0 && pending.length === 0 ? (
            <div className="empty-state" style={{ padding: "40px 16px" }}>
              <span className="empty-state-icon"><FileText size={18} /></span>
              <h2>No documents yet</h2>
              <p>Drop the tender files here. Each one is converted to Markdown so MCP agents can read it.</p>
            </div>
          ) : null}
          {documents.length < documentTotalCount ? (
            <p className="list-footer" style={{ padding: "0 8px" }}>Showing the newest {documents.length} of {documentTotalCount} documents.</p>
          ) : null}
        </div>
      </aside>

      <section aria-label="Document reader" className="reader">
        {selected ? (
          <>
            <div className="reader-header">
              <div style={{ minWidth: 0 }}>
                <h2 title={entryTitle(selected)}>{entryTitle(selected)}</h2>
                <p suppressHydrationWarning>
                  {selected.kind === "document" ? `Converted Markdown${markdown ? ` · ${markdown.length.toLocaleString()} characters` : ""}` : "Original file only"}
                  {selectedFile ? ` · ${selectedFile.original_filename}` : ""}
                </p>
              </div>
              <div className="header-actions">
                {markdown ? (
                  <button className="btn btn-secondary btn-sm" onClick={() => void navigator.clipboard.writeText(markdown).then(() => toast("Markdown copied"), () => toast("Could not copy", "error"))} type="button">
                    <Copy size={14} />Copy Markdown
                  </button>
                ) : null}
                {selectedFile ? (
                  <button className="btn btn-secondary btn-sm" onClick={() => void download(selectedFile)} type="button"><Download size={14} />Original</button>
                ) : null}
                <button aria-label="Delete document" className="btn btn-ghost btn-sm btn-icon" onClick={() => void remove(selected)} title="Delete document" type="button"><Trash2 size={14} /></button>
              </div>
            </div>
            <div className="reader-scroll">
              {selected.kind === "original" ? (
                <div className="reader-placeholder">
                  <strong>This file has no converted text</strong>
                  <p>MCP agents can only fetch it as a raw download. Re-upload it to convert, or download the original.</p>
                </div>
              ) : markdown ? (
                <MarkdownView>{markdown}</MarkdownView>
              ) : selectedDocument && loadErrorById[selectedDocument.id] ? (
                <div className="notice notice-error"><AlertCircle size={15} />{loadErrorById[selectedDocument.id]}</div>
              ) : (
                <div aria-busy="true" className="prose">
                  {[92, 80, 86, 64, 90, 72].map((width) => <div className="skeleton" key={width} style={{ height: 13, width: `${width}%`, marginBottom: 12 }} />)}
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="reader-placeholder">
            <UploadCloud size={22} />
            <strong>Upload the tender documents</strong>
            <p>Drag files anywhere on this page. Converted text appears here for reading.</p>
          </div>
        )}
      </section>
    </div>
  );
}
