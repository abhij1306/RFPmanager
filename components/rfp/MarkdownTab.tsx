import { Copy, Download, FileText, Pencil } from "lucide-react";
import { useState } from "react";
import { MarkdownView } from "@/components/MarkdownView";
import { toast } from "@/components/ui/feedback";
import { fileExtension, formatRelativeTime, formatTimestamp } from "@/lib/display";
import { getErrorMessage } from "@/lib/errors";
import { createRfpFileDownloadUrl } from "@/lib/rfp-files";
import type { RfpFile } from "@/lib/types";

type SaveResult = { content: string; savedAt: string | null };

export function MarkdownTab({
  emptyBody,
  emptyTitle,
  exportName,
  files = [],
  initialContent,
  initialSavedAt,
  label,
  onSave,
}: {
  emptyBody: string;
  emptyTitle: string;
  exportName?: string;
  files?: RfpFile[];
  initialContent: string;
  initialSavedAt: string | null;
  label: string;
  onSave: (content: string) => Promise<SaveResult>;
}) {
  const [content, setContent] = useState(initialContent);
  const [savedAt, setSavedAt] = useState(initialSavedAt);
  const [draft, setDraft] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const isEditing = draft !== null;
  const isDirty = isEditing && draft !== content;

  async function save() {
    if (draft === null || isSaving) return;
    setIsSaving(true);
    try {
      const result = await onSave(draft);
      setContent(result.content);
      setSavedAt(result.savedAt);
      setDraft(null);
      toast(`${label} saved`);
    } catch (error) {
      toast(getErrorMessage(error, `Could not save the ${label.toLowerCase()}.`), "error");
    } finally {
      setIsSaving(false);
    }
  }

  function exportMarkdown() {
    const url = URL.createObjectURL(new Blob([content], { type: "text/markdown;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `${(exportName ?? label).replace(/[^a-z0-9-_]+/gi, "-")}.md`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function download(file: RfpFile) {
    try {
      window.location.assign(await createRfpFileDownloadUrl(file));
    } catch (error) {
      toast(getErrorMessage(error, "Could not create a download link."), "error");
    }
  }

  return (
    <div className="doc-pane">
      <div className="doc-pane-header">
        <div>
          <h2>{label}</h2>
          <p suppressHydrationWarning title={savedAt ? formatTimestamp(savedAt) : undefined}>
            {isDirty ? "Unsaved changes" : savedAt && content ? `Saved ${formatRelativeTime(savedAt)}` : "Not saved yet"}
          </p>
        </div>
        <div className="header-actions">
          {isEditing ? (
            <>
              <button className="btn btn-ghost" disabled={isSaving} onClick={() => setDraft(null)} type="button">Cancel</button>
              <button className="btn btn-primary" disabled={isSaving || !isDirty} onClick={() => void save()} type="button">
                {isSaving ? "Saving…" : "Save"}<kbd className="kbd">Ctrl S</kbd>
              </button>
            </>
          ) : (
            <>
              {content && exportName ? (
                <button className="btn btn-secondary btn-sm" onClick={exportMarkdown} type="button"><Download size={14} />Export .md</button>
              ) : null}
              {content ? (
                <button className="btn btn-secondary btn-sm" onClick={() => void navigator.clipboard.writeText(content).then(() => toast(`${label} copied`), () => toast("Could not copy", "error"))} type="button">
                  <Copy size={14} />Copy
                </button>
              ) : null}
              <button className="btn btn-secondary btn-sm" onClick={() => setDraft(content)} type="button"><Pencil size={14} />{content ? "Edit" : "Write"}</button>
            </>
          )}
        </div>
      </div>

      {isEditing ? (
        <textarea
          aria-label={`${label} Markdown`}
          autoFocus
          className="textarea editor-textarea"
          disabled={isSaving}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
              event.preventDefault();
              void save();
            }
          }}
          placeholder="Write in Markdown…"
          value={draft}
        />
      ) : content ? (
        <MarkdownView>{content}</MarkdownView>
      ) : (
        <div className="panel">
          <div className="empty-state">
            <span className="empty-state-icon"><FileText size={18} /></span>
            <h2>{emptyTitle}</h2>
            <p>{emptyBody}</p>
          </div>
        </div>
      )}

      {files.length > 0 ? (
        <section style={{ marginTop: 32 }}>
          <div className="doc-pane-header"><div><h2 style={{ fontSize: 14 }}>Response files</h2><p>Saved by agents or uploaded earlier</p></div></div>
          <ul className="file-list panel" style={{ padding: "0 16px" }}>
            {files.map((file) => (
              <li className="file-row" key={file.id}>
                <span className="file-badge" data-type={fileExtension(file.original_filename)}>{fileExtension(file.original_filename)}</span>
                <span className="file-main">
                  <strong>{file.title}</strong>
                  <span suppressHydrationWarning>{file.original_filename} · {formatRelativeTime(file.created_at)}</span>
                </span>
                <button className="btn btn-secondary btn-sm" onClick={() => void download(file)} type="button"><Download size={14} />Download</button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
