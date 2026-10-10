"use client";

import { CalendarDays, ChevronRight, Copy, ExternalLink, FolderOpen, Hash, MoreHorizontal, Pencil, Trash2, Upload } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { DetailsTab } from "@/components/rfp/DetailsTab";
import { DocumentsTab } from "@/components/rfp/DocumentsTab";
import { MarkdownTab } from "@/components/rfp/MarkdownTab";
import { confirmAction, toast, useDismissable } from "@/components/ui/feedback";
import { closingInfo, displayTitle } from "@/lib/display";
import { getErrorMessage } from "@/lib/errors";
import { FILE_ACCEPT } from "@/lib/file-accept";
import { deleteRfp, updateRfpResponseDraft, updateRfpSummary } from "@/lib/rfps";
import { enqueueUploads } from "@/lib/upload-queue";
import type { Rfp, RfpDocument, RfpFile } from "@/lib/types";

type Tab = "documents" | "summary" | "response" | "details";

function tabFromView(view: string | null): Tab {
  if (view === "summary" || view === "response" || view === "details") return view;
  return "documents";
}

async function copyText(value: string, label: string) {
  try {
    await navigator.clipboard.writeText(value);
    toast(`${label} copied`);
  } catch {
    toast(`Could not copy ${label.toLowerCase()}`, "error");
  }
}

export function RfpDetail({
  documentTotalCount,
  documents,
  files,
  initialView,
  rfp,
}: {
  documentTotalCount: number;
  documents: RfpDocument[];
  files: RfpFile[];
  initialView: string | null;
  rfp: Rfp;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>(() => tabFromView(initialView));
  const [editingDetails, setEditingDetails] = useState(false);
  const [documentCount, setDocumentCount] = useState(documentTotalCount);
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const { open: menuOpen, setOpen: setMenuOpen, ref: menuRef } = useDismissable<HTMLDivElement>();
  const closing = closingInfo(rfp.closing_date, rfp.closing_date_text);
  const title = displayTitle(rfp.client_name);

  function selectTab(next: Tab) {
    setTab(next);
    const url = new URL(window.location.href);
    if (next === "documents") url.searchParams.delete("view");
    else url.searchParams.set("view", next);
    url.searchParams.delete("document");
    window.history.replaceState(window.history.state, "", url);
  }

  async function onDelete() {
    setMenuOpen(false);
    const confirmed = await confirmAction({
      title: "Delete this RFP?",
      body: `${title} and its ${documentCount} documents will be removed for everyone, including MCP agents. This cannot be undone.`,
      confirmLabel: "Delete RFP",
      tone: "danger",
    });
    if (!confirmed) return;
    try {
      await deleteRfp(rfp.id);
      toast("RFP deleted");
      router.push("/");
    } catch (error) {
      toast(getErrorMessage(error, "Could not delete the RFP."), "error");
    }
  }

  const tabs: Array<{ id: Tab; label: string; count?: number }> = [
    { id: "documents", label: "Documents", count: documentCount },
    { id: "summary", label: "Summary" },
    { id: "response", label: "Response draft" },
    { id: "details", label: "Details" },
  ];

  return (
    <div className="detail">
      <header className="detail-header">
        <nav aria-label="Breadcrumb" className="breadcrumb">
          <Link href="/">RFPs</Link>
          <ChevronRight size={13} />
          <span>{rfp.tender_code || "RFP"}</span>
        </nav>
        <div className="detail-title-row">
          <h1 title={rfp.client_name}>{title}</h1>
          <div className="header-actions">
            <input
              accept={FILE_ACCEPT}
              hidden
              multiple
              onChange={(event) => {
                enqueueUploads(rfp.id, Array.from(event.target.files ?? []));
                event.target.value = "";
                selectTab("documents");
              }}
              ref={uploadInputRef}
              type="file"
            />
            <button className="btn btn-primary" onClick={() => uploadInputRef.current?.click()} type="button">
              <Upload size={15} />
              Upload documents
            </button>
            <div className="menu-anchor" ref={menuRef}>
              <button aria-expanded={menuOpen} aria-haspopup="menu" aria-label="More actions" className="btn btn-secondary btn-icon" onClick={() => setMenuOpen(!menuOpen)} type="button">
                <MoreHorizontal size={16} />
              </button>
              {menuOpen ? (
                <div className="menu" role="menu">
                  <button className="menu-item" onClick={() => { setMenuOpen(false); setEditingDetails(true); selectTab("details"); }} role="menuitem" type="button">
                    <Pencil size={15} />Edit details
                  </button>
                  <button className="menu-item" onClick={() => { setMenuOpen(false); void copyText(rfp.id, "RFP ID"); }} role="menuitem" type="button">
                    <Copy size={15} />Copy RFP ID for MCP
                  </button>
                  <div className="menu-separator" />
                  <button className="menu-item menu-item-danger" onClick={() => void onDelete()} role="menuitem" type="button">
                    <Trash2 size={15} />Delete RFP
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <div className="meta-row">
          {rfp.tender_code ? (
            <button className="chip mono" onClick={() => void copyText(rfp.tender_code ?? "", "Tender code")} title="Copy tender code" type="button">
              <Hash size={13} />{rfp.tender_code}
            </button>
          ) : null}
          {closing.kind === "date" ? (
            <span className="chip tabular" data-urgency={closing.urgency === "soon" ? "soon" : undefined} suppressHydrationWarning>
              <CalendarDays size={13} />Closes {closing.label} · {closing.relative}
            </span>
          ) : closing.kind === "text" ? (
            <span className="chip" title={closing.label}><CalendarDays size={13} />{closing.label.length > 48 ? `${closing.label.slice(0, 48)}…` : closing.label}</span>
          ) : null}
          {rfp.tender_link ? (
            <a className="chip" href={rfp.tender_link} rel="noreferrer" target="_blank"><ExternalLink size={13} />Tender page</a>
          ) : null}
          {rfp.gdrive_link ? (
            <a className="chip" href={rfp.gdrive_link} rel="noreferrer" target="_blank"><FolderOpen size={13} />Google Drive</a>
          ) : null}
          {rfp.document_links.length > 0 ? (
            <button className="chip" onClick={() => selectTab("details")} type="button"><ExternalLink size={13} />{rfp.document_links.length} portal links</button>
          ) : null}
        </div>

        <div aria-label="RFP sections" className="tabs" role="tablist">
          {tabs.map((item) => (
            <button
              aria-controls={`panel-${item.id}`}
              aria-selected={tab === item.id}
              className="tab"
              id={`tab-${item.id}`}
              key={item.id}
              onClick={() => selectTab(item.id)}
              role="tab"
              type="button"
            >
              {item.label}
              {item.count !== undefined ? <span className="tab-count tabular">{item.count}</span> : null}
            </button>
          ))}
        </div>
      </header>

      <div className="detail-body">
        {/* Panels stay mounted so switching tabs never discards an unsaved edit. */}
        <section aria-labelledby="tab-documents" className="tab-panel" hidden={tab !== "documents"} id="panel-documents" role="tabpanel">
          <DocumentsTab
            documentTotalCount={documentTotalCount}
            documents={documents}
            files={files}
            onCountChange={setDocumentCount}
            rfpId={rfp.id}
          />
        </section>
        <section aria-labelledby="tab-summary" className="tab-panel" hidden={tab !== "summary"} id="panel-summary" role="tabpanel">
          <MarkdownTab
            emptyBody="Summaries are written by MCP agents after they read the documents. Ask your agent to summarise this RFP, or write one here."
            emptyTitle="No summary yet"
            initialContent={rfp.summary ?? ""}
            initialSavedAt={rfp.summary_generated_at}
            label="Summary"
            onSave={async (content) => {
              const saved = await updateRfpSummary(rfp.id, content);
              return { content: saved.summary ?? "", savedAt: saved.summary_generated_at };
            }}
          />
        </section>
        <section aria-labelledby="tab-response" className="tab-panel" hidden={tab !== "response"} id="panel-response" role="tabpanel">
          <MarkdownTab
            emptyBody="Agents can save a response draft through MCP. You can also write or paste one here."
            emptyTitle="No response draft yet"
            exportName={rfp.response_draft_title || `${title} response`}
            files={files.filter((file) => file.kind === "response")}
            initialContent={rfp.response_draft_content ?? ""}
            initialSavedAt={rfp.response_draft_saved_at}
            label="Response draft"
            onSave={async (content) => {
              const saved = await updateRfpResponseDraft(rfp.id, rfp.response_draft_title?.trim() || "Response draft", content);
              return { content: saved.response_draft_content ?? "", savedAt: saved.response_draft_saved_at };
            }}
          />
        </section>
        <section aria-labelledby="tab-details" className="tab-panel" hidden={tab !== "details"} id="panel-details" role="tabpanel">
          <DetailsTab editing={editingDetails} onEditingChange={setEditingDetails} rfp={rfp} />
        </section>
      </div>
    </div>
  );
}
