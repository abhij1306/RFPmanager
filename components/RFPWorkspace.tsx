"use client";

import { useRef, useState } from "react";
import { createComment, deleteComment } from "@/lib/comments";
import { convertFile } from "@/lib/document-conversion";
import { createDocument, deleteDocument } from "@/lib/documents";
import { createRfpFileDownloadUrl, deleteRfpFile, uploadRfpFile } from "@/lib/rfp-files";
import { uploadSourceDocuments } from "@/lib/rfp-source-documents";
import type { Rfp, RfpComment, RfpDocument, RfpDocumentSourceType, RfpFile } from "@/lib/types";

type WorkspaceTab = "summary" | "sources" | "markdown" | "response" | "team";

const FILE_ACCEPT =
  ".docx,.pdf,.xlsx,.csv,.md,.markdown,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv,text/markdown,text/plain";

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function combineDocumentMarkdown(documents: RfpDocument[]): string {
  return documents.map((document) => `# ${document.title}\n\n${document.markdown}`).join("\n\n");
}

function formatFileMeta(file: RfpFile): string {
  const size =
    file.file_size_bytes && file.file_size_bytes > 0
      ? `${(file.file_size_bytes / 1024 / 1024).toFixed(1)} MB`
      : file.status ?? "Saved";
  const type = file.original_filename.split(".").pop()?.toUpperCase() ?? "FILE";

  return `${size} · ${type}`;
}

export function RFPWorkspace({
  comments,
  documents,
  files,
  rfp,
}: {
  comments: RfpComment[];
  documents: RfpDocument[];
  files: RfpFile[];
  rfp: Rfp;
}) {
  // ── State ─────────────────────────────────────────────────────────────────
  const [commentList, setCommentList] = useState(comments);
  const [documentList, setDocumentList] = useState(documents);
  const [fileList, setFileList] = useState(files);
  const [commentBody, setCommentBody] = useState("");
  const [activeDocument, setActiveDocument] = useState<RfpDocument | null>(null);
  const [summary, setSummary] = useState(rfp.summary ?? "");
  const [summaryGeneratedAt, setSummaryGeneratedAt] = useState(rfp.summary_generated_at);
  const [markdownDraft, setMarkdownDraft] = useState("");
  const [markdownTitle, setMarkdownTitle] = useState("");
  const [sourceFileName, setSourceFileName] = useState("");
  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [sourceType, setSourceType] = useState<RfpDocumentSourceType>("markdown");
  const [responseNotes, setResponseNotes] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [messageType, setMessageType] = useState<"info" | "error">("info");
  const [isConverting, setIsConverting] = useState(false);
  const [isSavingMarkdown, setIsSavingMarkdown] = useState(false);
  const [isUploadingResponse, setIsUploadingResponse] = useState(false);
  const [isPosting, setIsPosting] = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [bulkProgress, setBulkProgress] = useState("");
  const [isBulkUploading, setIsBulkUploading] = useState(false);
  const [activeTab, setActiveTab] = useState<WorkspaceTab>("sources");

  const sourceInputRef = useRef<HTMLInputElement>(null);
  const bulkSourceInputRef = useRef<HTMLInputElement>(null);
  const responseInputRef = useRef<HTMLInputElement>(null);
  const sourceFiles = fileList.filter((file) => file.kind === "source");
  const responseFiles = fileList.filter((file) => file.kind === "response");

  // ── Handlers (unchanged) ──────────────────────────────────────────────────
  async function handleFiles(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;

    setIsConverting(true);
    setMessage(null);
    setMessageType("info");
    setSourceFileName(file.name);
    setSourceFile(file);
    setMarkdownTitle(file.name.replace(/\.[^.]+$/, ""));

    try {
      const result = await convertFile(file);
      setMarkdownDraft(result.markdown);
      setSourceType(result.sourceType);
      setMessage("Markdown is ready to review and save.");
    } catch (error) {
      setMarkdownDraft("");
      setSourceFile(null);
      setMessageType("error");
      setMessage(error instanceof Error ? error.message : "Could not convert this file.");
    } finally {
      setIsConverting(false);
    }
  }

  async function addComment() {
    const body = commentBody.trim();
    if (!body) return;

    setIsPosting(true);
    setMessage(null);
    setMessageType("info");

    try {
      const saved = await createComment({ rfp_id: rfp.id, author_name: "Team", body });
      setCommentList((current) => [saved, ...current]);
      setCommentBody("");
    } catch (error) {
      setMessageType("error");
      setMessage(error instanceof Error ? error.message : "Could not add comment.");
    } finally {
      setIsPosting(false);
    }
  }

  async function removeComment(id: string) {
    setMessage(null);
    setMessageType("info");
    try {
      await deleteComment(id);
      setCommentList((current) => current.filter((comment) => comment.id !== id));
    } catch (error) {
      setMessageType("error");
      setMessage(error instanceof Error ? error.message : "Could not delete comment.");
    }
  }

  async function removeDocument(id: string) {
    if (!window.confirm("Delete this saved markdown?")) return;
    setMessage(null);
    setMessageType("info");
    try {
      await deleteDocument(id);
      setDocumentList((current) => current.filter((document) => document.id !== id));
      if (activeDocument?.id === id) {
        setActiveDocument(documentList.find((document) => document.id !== id) ?? null);
      }
    } catch (error) {
      setMessageType("error");
      setMessage(error instanceof Error ? error.message : "Could not delete saved markdown.");
    }
  }

  async function downloadFile(file: RfpFile) {
    setMessage(null);
    setMessageType("info");
    try {
      const url = await createRfpFileDownloadUrl(file);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (error) {
      setMessageType("error");
      setMessage(error instanceof Error ? error.message : "Could not create a download link.");
    }
  }

  async function removeFile(file: RfpFile) {
    if (!window.confirm(`Delete ${file.original_filename}?`)) return;
    setMessage(null);
    setMessageType("info");
    try {
      await deleteRfpFile(file);
      setFileList((current) => current.filter((item) => item.id !== file.id));
      setMessage("File deleted.");
    } catch (error) {
      setMessageType("error");
      setMessage(error instanceof Error ? error.message : "Could not delete file.");
    }
  }

  async function uploadResponse(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;

    setIsUploadingResponse(true);
    setMessage(null);
    setMessageType("info");

    try {
      const saved = await uploadRfpFile({
        body: file,
        kind: "response",
        mimeType: file.type || null,
        notes: responseNotes.trim() || null,
        originalFilename: file.name,
        rfpId: rfp.id,
        status: "Draft",
        title: file.name.replace(/\.[^.]+$/, "") || file.name,
      });
      setFileList((current) => [saved, ...current]);
      setResponseNotes("");
      setMessage("Response file saved.");
      if (responseInputRef.current) responseInputRef.current.value = "";
    } catch (error) {
      setMessageType("error");
      setMessage(error instanceof Error ? error.message : "Could not save response file.");
    } finally {
      setIsUploadingResponse(false);
    }
  }

  async function bulkUploadSources(files: FileList | null) {
    const selectedFiles = Array.from(files ?? []);
    if (selectedFiles.length === 0) return;

    setIsBulkUploading(true);
    setBulkProgress(`0/${selectedFiles.length}`);
    setMessage(null);
    setMessageType("info");

    try {
      const saved = await uploadSourceDocuments({
        files: selectedFiles,
        onProgress: (completed, total, file) => {
          setBulkProgress(`${completed}/${total}`);
          setMessage(`Saved ${completed}/${total}: ${file.name}`);
        },
        rfpId: rfp.id,
      });
      const savedDocuments = saved.map((item) => item.document);
      const savedFiles = saved.map((item) => item.sourceFile);
      const nextDocuments = [...savedDocuments, ...documentList];

      setDocumentList(nextDocuments);
      setFileList((current) => [...savedFiles, ...current]);
      setActiveDocument(savedDocuments[0] ?? activeDocument);
      setMessage(`${saved.length} source document${saved.length === 1 ? "" : "s"} saved with converted markdown.`);
    } catch (error) {
      setMessageType("error");
      setMessage(error instanceof Error ? error.message : "Could not bulk upload source documents.");
    } finally {
      setIsBulkUploading(false);
      setBulkProgress("");
      if (bulkSourceInputRef.current) bulkSourceInputRef.current.value = "";
    }
  }

  async function generateSummary(documentsToSummarize = documentList) {
    const markdown = combineDocumentMarkdown(documentsToSummarize);
    if (!markdown.trim()) {
      setMessageType("error");
      setMessage("Save converted markdown before generating a summary.");
      return;
    }
    setIsSummarizing(true);
    setMessage(null);
    setMessageType("info");
    try {
      const response = await fetch("/api/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rfp_id: rfp.id, markdown }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not generate summary.");
      setSummary(data.summary);
      setSummaryGeneratedAt(data.rfp?.summary_generated_at ?? new Date().toISOString());
      setMessageType("info");
      setMessage("Summary generated and autosaved.");
    } catch (error) {
      setMessageType("error");
      setMessage(error instanceof Error ? error.message : "Could not generate summary.");
    } finally {
      setIsSummarizing(false);
    }
  }

  async function saveMarkdown(generateAfterSave = false) {
    const markdown = markdownDraft.trim();
    if (!markdown) {
      setMessageType("error");
      setMessage("Add or upload markdown before saving.");
      return;
    }
    setIsSavingMarkdown(true);
    setMessage(null);
    setMessageType("info");
    try {
      let sourceFileId: string | null = null;
      if (sourceFile) {
        const savedSourceFile = await uploadRfpFile({
          body: sourceFile,
          kind: "source",
          mimeType: sourceFile.type || null,
          originalFilename: sourceFile.name,
          rfpId: rfp.id,
          status: generateAfterSave ? "Converted and summarized" : "Converted",
          title: markdownTitle.trim() || sourceFileName || sourceFile.name,
        });
        sourceFileId = savedSourceFile.id;
        setFileList((current) => [savedSourceFile, ...current]);
      }
      const saved = await createDocument({
        rfp_id: rfp.id,
        source_file_id: sourceFileId,
        title: markdownTitle.trim() || sourceFileName || "Saved markdown",
        source_filename: sourceFileName || null,
        source_type: sourceType,
        markdown,
      });
      const nextDocuments = [saved, ...documentList];
      setDocumentList(nextDocuments);
      setActiveDocument(saved);
      setMarkdownDraft("");
      setMarkdownTitle("");
      setSourceFileName("");
      setSourceFile(null);
      setSourceType("markdown");
      if (sourceInputRef.current) sourceInputRef.current.value = "";
      setMessage(generateAfterSave ? "Markdown saved. Generating summary..." : "Markdown saved to this RFP.");
      if (generateAfterSave) await generateSummary(nextDocuments);
    } catch (error) {
      setMessageType("error");
      setMessage(error instanceof Error ? error.message : "Could not save markdown.");
    } finally {
      setIsSavingMarkdown(false);
    }
  }

  // ── Tab config ────────────────────────────────────────────────────────────
  const tabs: { id: WorkspaceTab; label: string; count?: number }[] = [
    { id: "sources", label: "Sources", count: sourceFiles.length + rfp.document_links.length },
    { id: "markdown", label: "Markdown", count: documentList.length },
    { id: "summary", label: "Summary" },
    { id: "response", label: "Response", count: responseFiles.length },
    { id: "team", label: "Team", count: commentList.length },
  ];

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <aside className="workspace-panel">
      {/* Global status banner */}
      {message ? (
        <div className={`notice ${messageType === "error" ? "error" : ""}`}>{message}</div>
      ) : null}

      {/* ── Tab bar ── */}
      <nav className="workspace-tabs">
        {tabs.map((tab) => (
          <button
            className={`workspace-tab ${activeTab === tab.id ? "active" : ""}`}
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
            {tab.count !== undefined && tab.count > 0 ? (
              <span className="tab-badge">{tab.count}</span>
            ) : null}
          </button>
        ))}
      </nav>

      {/* ══ SUMMARY ══════════════════════════════════════════════════════════ */}
      {activeTab === "summary" && (
        <section className="workspace-section">
          <div className="section-heading">
            <div>
              <h2>Summary</h2>
              <p>
                {summaryGeneratedAt
                  ? `Autosaved ${formatDate(summaryGeneratedAt)}`
                  : "Generate from saved markdown"}
              </p>
            </div>
            <button
              className="button compact-button"
              disabled={isSummarizing}
              onClick={() => void generateSummary()}
              type="button"
            >
              {isSummarizing ? "Generating..." : "Generate"}
            </button>
          </div>
          {summary ? (
            <pre className="markdown-preview document-preview">{summary}</pre>
          ) : (
            <div className="empty-library">No summary generated yet.</div>
          )}
        </section>
      )}

      {/* ══ SOURCES ══════════════════════════════════════════════════════════ */}
      {activeTab === "sources" && (
        <div className="sources-tab">

          {/* ── 1. What you have: Tender Links + Uploaded Files ── */}
          <div className="source-assets-grid">
            <section className="workspace-section">
              <div className="section-heading">
                <div>
                  <h2>Tender Links</h2>
                  <p>{rfp.document_links.length} imported document URLs</p>
                </div>
              </div>
              <div className="document-list compact-list">
                {rfp.document_links.map((link) => (
                  <a
                    className="document-row"
                    href={link.url}
                    key={`${link.name}-${link.url}`}
                    rel="noreferrer"
                    target="_blank"
                  >
                    <div className="file-icon">URL</div>
                    <span className="document-main">
                      <span className="document-title">{link.name || link.url}</span>
                      <span className="document-meta">{link.url}</span>
                    </span>
                  </a>
                ))}
                {rfp.document_links.length === 0 ? (
                  <div className="empty-library">Imported tender document links will appear here.</div>
                ) : null}
              </div>
            </section>

            <section className="workspace-section">
              <div className="section-heading">
                <div>
                  <h2>Uploaded Files</h2>
                  <p>{sourceFiles.length} original files saved</p>
                </div>
                <button
                  className="ghost-button compact-button"
                  disabled={isBulkUploading}
                  onClick={() => bulkSourceInputRef.current?.click()}
                  type="button"
                >
                  {isBulkUploading ? `Saving ${bulkProgress}` : "Bulk Upload"}
                </button>
              </div>
              <input
                accept={FILE_ACCEPT}
                hidden
                multiple
                onChange={(event) => void bulkUploadSources(event.target.files)}
                ref={bulkSourceInputRef}
                type="file"
              />
              <div className="document-list compact-list">
                {sourceFiles.map((file) => (
                  <article className="document-row" key={file.id}>
                    <div className="file-icon">SRC</div>
                    <span className="document-main">
                      <span className="document-title">{file.title}</span>
                      <span className="document-meta">
                        {file.original_filename} · {formatFileMeta(file)} · {formatDate(file.created_at)}
                      </span>
                    </span>
                    <button className="ghost-button compact-button" onClick={() => void downloadFile(file)} type="button">
                      Download
                    </button>
                    <button className="ghost-button compact-button" onClick={() => void removeFile(file)} type="button">
                      Delete
                    </button>
                  </article>
                ))}
                {sourceFiles.length === 0 ? (
                  <div className="empty-library">Original uploaded documents will appear here.</div>
                ) : null}
              </div>
            </section>
          </div>
        </div>
      )}

      {/* ══ MARKDOWN ════════════════════════════════════════════════════════ */}
      {activeTab === "markdown" && (
        <div className="markdown-tab">
          <section className="workspace-section markdown-converter-panel">
            <div className="section-heading">
              <div>
                <h2>Convert to Markdown</h2>
                <p>Upload a document or paste markdown below.</p>
              </div>
            </div>
            <input
              accept={FILE_ACCEPT}
              hidden
              onChange={(event) => void handleFiles(event.target.files)}
              ref={sourceInputRef}
              type="file"
            />
            <div className="upload-control-row">
              <button className="button compact-button" onClick={() => sourceInputRef.current?.click()} type="button">
                {isConverting ? "Converting..." : "Upload File"}
              </button>
              <span className="document-meta">{sourceFileName || "DOCX · PDF · XLSX · CSV · MD · TXT"}</span>
            </div>
            <input
              className="input"
              onChange={(event) => setMarkdownTitle(event.target.value)}
              placeholder="Markdown title"
              value={markdownTitle}
            />
            <textarea
              className="textarea markdown-draft"
              onChange={(event) => {
                setMarkdownDraft(event.target.value);
                if (!sourceFileName) setSourceType("markdown");
              }}
              placeholder="Paste markdown here, or upload a file above to auto-convert."
              value={markdownDraft}
            />
            <div className="form-actions flush-actions">
              <button
                className="button"
                disabled={!markdownDraft.trim() || isSavingMarkdown}
                onClick={() => void saveMarkdown(false)}
                type="button"
              >
                {isSavingMarkdown ? "Saving..." : "Save Markdown"}
              </button>
              <button
                className="ghost-button"
                disabled={!markdownDraft.trim() || isSavingMarkdown || isSummarizing}
                onClick={() => void saveMarkdown(true)}
                type="button"
              >
                {isSavingMarkdown || isSummarizing ? "Working..." : "Save & Generate"}
              </button>
            </div>
          </section>

          <section className="workspace-section source-markdown-section">
            <div className="section-heading">
              <div>
                <h2>Saved Markdown</h2>
                <p>{documentList.length} converted markdown files</p>
              </div>
            </div>
            <div className="document-list markdown-accordion-list">
                {documentList.map((document) => (
                  <article
                    className={`document-row markdown-accordion-item ${activeDocument?.id === document.id ? "active" : ""}`}
                    key={document.id}
                  >
                    <div className="markdown-accordion-summary">
                      <div className="file-icon">MD</div>
                      <button
                        className="document-main text-button"
                        onClick={() => setActiveDocument(activeDocument?.id === document.id ? null : document)}
                        type="button"
                      >
                        <span className="document-title">{document.title}</span>
                        <span className="document-meta">
                          {document.source_type.toUpperCase()} · {formatDate(document.created_at)}
                        </span>
                      </button>
                      <button className="ghost-button compact-button" onClick={() => void removeDocument(document.id)} type="button">
                        Delete
                      </button>
                    </div>
                    {activeDocument?.id === document.id ? (
                      <pre className="markdown-preview markdown-accordion-preview">{document.markdown}</pre>
                    ) : null}
                  </article>
                ))}
                {documentList.length === 0 ? <div className="empty-library">Converted markdown will appear here.</div> : null}
            </div>
          </section>
        </div>
      )}

      {/* ══ RESPONSE ═════════════════════════════════════════════════════════ */}
      {activeTab === "response" && (
        <section className="workspace-section">
          <div className="section-heading">
            <div>
              <h2>Responses</h2>
              <p>{responseFiles.length} response files saved</p>
            </div>
            <button
              className="ghost-button compact-button"
              onClick={() => responseInputRef.current?.click()}
              type="button"
            >
              {isUploadingResponse ? "Uploading..." : "Upload"}
            </button>
          </div>
          <input
            accept={FILE_ACCEPT}
            hidden
            onChange={(event) => void uploadResponse(event.target.files)}
            ref={responseInputRef}
            type="file"
          />
          <textarea
            className="textarea compact-textarea"
            onChange={(event) => setResponseNotes(event.target.value)}
            placeholder="Optional response notes"
            value={responseNotes}
          />
          <div className="document-list compact-list">
            {responseFiles.map((file) => (
              <article className="document-row" key={file.id}>
                <div className="file-icon">RSP</div>
                <span className="document-main">
                  <span className="document-title">{file.title}</span>
                  <span className="document-meta">
                    {file.original_filename} · {file.status ?? "Saved"} · {formatDate(file.created_at)}
                  </span>
                </span>
                <button className="ghost-button compact-button" onClick={() => void downloadFile(file)} type="button">
                  Download
                </button>
                <button className="ghost-button compact-button" onClick={() => void removeFile(file)} type="button">
                  Delete
                </button>
              </article>
            ))}
            {responseFiles.length === 0 ? (
              <div className="empty-library">Response files will appear here.</div>
            ) : null}
          </div>
        </section>
      )}

      {/* ══ TEAM ═════════════════════════════════════════════════════════════
          Comments                                                             */}
      {activeTab === "team" && (
        <section className="workspace-section">
          <div className="section-heading">
            <div>
              <h2>Comments</h2>
              <p>{commentList.length} notes from the team</p>
            </div>
          </div>
          <textarea
            className="textarea"
            onChange={(event) => setCommentBody(event.target.value)}
            placeholder="Add a comment or follow-up note"
            value={commentBody}
          />
          <div className="form-actions flush-actions">
            <button
              className="button"
              disabled={!commentBody.trim() || isPosting}
              onClick={() => void addComment()}
              type="button"
            >
              {isPosting ? "Posting..." : "Add Comment"}
            </button>
          </div>
          <div className="comment-list">
            {commentList.map((comment) => (
              <article className="comment-row" key={comment.id}>
                <div>
                  <div className="comment-meta">
                    {comment.author_name} · {formatDate(comment.created_at)}
                  </div>
                  <p>{comment.body}</p>
                </div>
                <button className="text-danger" onClick={() => void removeComment(comment.id)} type="button">
                  Delete
                </button>
              </article>
            ))}
            {commentList.length === 0 ? (
              <div className="empty-library">Comments will appear here.</div>
            ) : null}
          </div>
        </section>
      )}
    </aside>
  );
}
