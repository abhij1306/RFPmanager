"use client";

import { useRef, useState } from "react";
import { createComment, deleteComment } from "@/lib/comments";
import { convertFile } from "@/lib/document-conversion";
import { createDocument, deleteDocument } from "@/lib/documents";
import type { Rfp, RfpComment, RfpDocument, RfpDocumentSourceType } from "@/lib/types";

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function combineDocumentMarkdown(documents: RfpDocument[]): string {
  return documents.map((document) => `# ${document.title}\n\n${document.markdown}`).join("\n\n");
}

export function RFPWorkspace({
  comments,
  documents,
  rfp,
}: {
  comments: RfpComment[];
  documents: RfpDocument[];
  rfp: Rfp;
}) {
  const [commentList, setCommentList] = useState(comments);
  const [documentList, setDocumentList] = useState(documents);
  const [commentBody, setCommentBody] = useState("");
  const [activeDocument, setActiveDocument] = useState<RfpDocument | null>(documents[0] ?? null);
  const [summary, setSummary] = useState(rfp.summary ?? "");
  const [summaryGeneratedAt, setSummaryGeneratedAt] = useState(rfp.summary_generated_at);
  const [markdownDraft, setMarkdownDraft] = useState("");
  const [markdownTitle, setMarkdownTitle] = useState("");
  const [sourceFileName, setSourceFileName] = useState("");
  const [sourceType, setSourceType] = useState<RfpDocumentSourceType>("markdown");
  const [message, setMessage] = useState<string | null>(null);
  const [messageType, setMessageType] = useState<"info" | "error">("info");
  const [isConverting, setIsConverting] = useState(false);
  const [isSavingMarkdown, setIsSavingMarkdown] = useState(false);
  const [isPosting, setIsPosting] = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFiles(files: FileList | null) {
    const file = files?.[0];
    if (!file) {
      return;
    }

    setIsConverting(true);
    setMessage(null);
    setMessageType("info");
    setSourceFileName(file.name);
    setMarkdownTitle(file.name.replace(/\.[^.]+$/, ""));

    try {
      const result = await convertFile(file);
      setMarkdownDraft(result.markdown);
      setSourceType(result.sourceType);
      setMessage("Markdown is ready to review and save.");
    } catch (error) {
      setMarkdownDraft("");
      setMessageType("error");
      setMessage(error instanceof Error ? error.message : "Could not convert this file.");
    } finally {
      setIsConverting(false);
    }
  }

  async function addComment() {
    const body = commentBody.trim();
    if (!body) {
      return;
    }

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
    if (!window.confirm("Delete this saved markdown?")) {
      return;
    }

    setMessage(null);
    setMessageType("info");

    try {
      await deleteDocument(id);
      setDocumentList((current) => current.filter((document) => document.id !== id));
      if (activeDocument?.id === id) {
        setActiveDocument(null);
      }
    } catch (error) {
      setMessageType("error");
      setMessage(error instanceof Error ? error.message : "Could not delete saved markdown.");
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

      if (!response.ok) {
        throw new Error(data.error ?? "Could not generate summary.");
      }

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
      const saved = await createDocument({
        rfp_id: rfp.id,
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
      setSourceType("markdown");
      setMessage(generateAfterSave ? "Markdown saved. Generating summary..." : "Markdown saved to this RFP.");

      if (generateAfterSave) {
        await generateSummary(nextDocuments);
      }
    } catch (error) {
      setMessageType("error");
      setMessage(error instanceof Error ? error.message : "Could not save markdown.");
    } finally {
      setIsSavingMarkdown(false);
    }
  }

  return (
    <aside className="workspace-panel">
      {message ? <div className={`notice ${messageType === "error" ? "error" : ""}`}>{message}</div> : null}

      <section className="workspace-section">
        <div className="section-heading">
          <div>
            <h2>Summary</h2>
            <p>{summaryGeneratedAt ? `Autosaved ${formatDate(summaryGeneratedAt)}` : "Generate from saved markdown"}</p>
          </div>
          <button className="button compact-button" disabled={isSummarizing} onClick={() => void generateSummary()} type="button">
            {isSummarizing ? "Generating..." : "Generate"}
          </button>
        </div>
        {summary ? <pre className="markdown-preview document-preview">{summary}</pre> : <div className="empty-library">No summary generated yet.</div>}
      </section>

      <section className="workspace-section">
        <div className="section-heading">
          <div>
            <h2>Add Markdown</h2>
            <p>{sourceFileName || "Upload a source file or paste markdown for this RFP"}</p>
          </div>
          <button className="ghost-button compact-button" onClick={() => inputRef.current?.click()} type="button">
            {isConverting ? "Converting..." : "Upload"}
          </button>
        </div>
        <input
          accept=".docx,.pdf,.xlsx,.csv,.md,.markdown,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv,text/markdown,text/plain"
          hidden
          onChange={(event) => void handleFiles(event.target.files)}
          ref={inputRef}
          type="file"
        />
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
            if (!sourceFileName) {
              setSourceType("markdown");
            }
          }}
          placeholder="Paste markdown here, or upload DOCX, PDF, XLSX, CSV, MD, Markdown, or TXT."
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
            Save & Generate
          </button>
        </div>
      </section>

      <section className="workspace-section">
        <div className="section-heading">
          <div>
            <h2>Tender Links</h2>
            <p>{rfp.document_links.length} imported document URLs</p>
          </div>
        </div>
        <div className="document-list compact-list">
          {rfp.document_links.map((link) => (
            <a className="document-row" href={link.url} key={`${link.name}-${link.url}`} rel="noreferrer" target="_blank">
              <div className="file-icon">URL</div>
              <span className="document-main">
                <span className="document-title">{link.name || link.url}</span>
                <span className="document-meta">{link.url}</span>
              </span>
            </a>
          ))}
          {rfp.document_links.length === 0 ? <div className="empty-library">Imported tender document links will appear here.</div> : null}
        </div>
      </section>

      <section className="workspace-section">
        <div className="section-heading">
          <div>
            <h2>Documents</h2>
            <p>{documentList.length} saved markdown files</p>
          </div>
        </div>
        <div className="document-list compact-list">
          {documentList.map((document) => (
            <article className={`document-row ${activeDocument?.id === document.id ? "active" : ""}`} key={document.id}>
              <div className="file-icon">MD</div>
              <button className="document-main text-button" onClick={() => setActiveDocument(document)} type="button">
                <span className="document-title">{document.title}</span>
                <span className="document-meta">
                  {document.source_type.toUpperCase()} · {formatDate(document.created_at)}
                </span>
              </button>
              <button className="ghost-button compact-button" onClick={() => void removeDocument(document.id)} type="button">
                Delete
              </button>
            </article>
          ))}
          {documentList.length === 0 ? <div className="empty-library">No markdown saved for this RFP yet.</div> : null}
        </div>
        {activeDocument ? (
          <pre className="markdown-preview document-preview">{activeDocument.markdown}</pre>
        ) : null}
      </section>

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
          <button className="button" disabled={!commentBody.trim() || isPosting} onClick={() => void addComment()} type="button">
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
          {commentList.length === 0 ? <div className="empty-library">Comments will appear here.</div> : null}
        </div>
      </section>
    </aside>
  );
}
