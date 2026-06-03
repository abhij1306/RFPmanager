"use client";

import { useState } from "react";
import { createComment, deleteComment } from "@/lib/comments";
import { deleteDocument } from "@/lib/documents";
import type { Rfp, RfpComment, RfpDocument } from "@/lib/types";

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
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
  const [message, setMessage] = useState<string | null>(null);
  const [isPosting, setIsPosting] = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false);

  async function addComment() {
    const body = commentBody.trim();
    if (!body) {
      return;
    }

    setIsPosting(true);
    setMessage(null);

    try {
      const saved = await createComment({ rfp_id: rfp.id, author_name: "Team", body });
      setCommentList((current) => [saved, ...current]);
      setCommentBody("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not add comment.");
    } finally {
      setIsPosting(false);
    }
  }

  async function removeComment(id: string) {
    await deleteComment(id);
    setCommentList((current) => current.filter((comment) => comment.id !== id));
  }

  async function removeDocument(id: string) {
    if (!window.confirm("Delete this saved markdown?")) {
      return;
    }

    await deleteDocument(id);
    setDocumentList((current) => current.filter((document) => document.id !== id));
    if (activeDocument?.id === id) {
      setActiveDocument(null);
    }
  }

  async function generateSummary() {
    const markdown = activeDocument?.markdown ?? documentList.map((document) => `# ${document.title}\n\n${document.markdown}`).join("\n\n");

    if (!markdown.trim()) {
      setMessage("Save converted markdown before generating a summary.");
      return;
    }

    setIsSummarizing(true);
    setMessage(null);

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
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not generate summary.");
    } finally {
      setIsSummarizing(false);
    }
  }

  return (
    <aside className="workspace-panel">
      {message ? <div className="notice error">{message}</div> : null}

      <section className="workspace-section">
        <div className="section-heading">
          <div>
            <h2>Summary</h2>
            <p>{summaryGeneratedAt ? `Generated ${formatDate(summaryGeneratedAt)}` : "Generate from saved markdown"}</p>
          </div>
          <button className="button compact-button" disabled={isSummarizing} onClick={() => void generateSummary()} type="button">
            {isSummarizing ? "Generating..." : "Generate"}
          </button>
        </div>
        {summary ? <textarea className="markdown-preview document-preview" readOnly value={summary} /> : <div className="empty-library">No summary generated yet.</div>}
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
          <textarea className="markdown-preview document-preview" readOnly value={activeDocument.markdown} />
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
