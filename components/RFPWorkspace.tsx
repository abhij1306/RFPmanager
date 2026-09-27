"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createComment, deleteComment } from "@/lib/comments";
import { convertFile } from "@/lib/document-conversion";
import { createDocument, deleteDocument } from "@/lib/documents";
import { getErrorMessage, PartialUploadError } from "@/lib/errors";
import { formatDateOnly } from "@/lib/date";
import { createRfpFileDownloadUrl, deleteRfpFile, uploadRfpFile } from "@/lib/rfp-files";
import { uploadSourceDocuments, type UploadedSourceDocument } from "@/lib/rfp-source-documents";
import { updateRfpResponseDraft, updateRfpSummary } from "@/lib/rfps";
import { MarkdownReadingView } from "@/components/MarkdownReadingView";
import type { Rfp, RfpComment, RfpDocument, RfpDocumentSourceType, RfpFile } from "@/lib/types";

type WorkspaceTab = "overview" | "documents" | "summary" | "response" | "team";

export type WorkspaceDocument = {
  id: string;
  category: "source" | "response";
  title: string;
  meta: string;
  status: string;
  file?: RfpFile;
  document?: RfpDocument;
  preview?: string;
};

type RFPWorkspaceProps = Readonly<{
  comments: RfpComment[];
  documentTotalCount: number;
  documents: RfpDocument[];
  files: RfpFile[];
  initialView?: string | null;
  rfp: Rfp;
}>;

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

function workspaceTabFromQuery(value: string | null): WorkspaceTab {
  if (value === "documents" || value === "summary" || value === "response" || value === "team") return value;
  return "overview";
}

function prependUniqueById<Item extends { id: string }>(items: Item[], current: Item[]): Item[] {
  const itemIds = new Set(items.map((item) => item.id));
  return [...items, ...current.filter((item) => !itemIds.has(item.id))];
}

async function readJsonResponse<Result>(response: Response, fallback: string): Promise<Result> {
  const data = (await response.json().catch(() => null)) as (Result & { error?: string }) | null;

  if (!response.ok) {
    throw new Error(data?.error ?? `${fallback} (${response.status})`);
  }

  if (!data) {
    throw new Error(fallback);
  }

  return data;
}

function deriveWorkspaceDocuments(documentList: RfpDocument[], fileList: RfpFile[]): WorkspaceDocument[] {
  const filesById = new Map(fileList.map((file) => [file.id, file]));
  const pairedSourceFileIds = new Set<string>();
  const converted = documentList.map((document) => {
    const file = document.source_file_id ? filesById.get(document.source_file_id) : undefined;
    if (file) pairedSourceFileIds.add(file.id);
    return {
      id: `document-${document.id}`,
      category: "source" as const,
      title: document.title,
      meta: `${document.source_type.toUpperCase()} · ${file ? formatFileMeta(file) : "Converted text"} · ${formatDate(document.created_at)}`,
      status: file ? "Converted" : "Saved markdown",
      file,
      document,
      preview: document.markdown || undefined,
    };
  });
  const unconverted = fileList
    .filter((file) => file.kind === "source" && !pairedSourceFileIds.has(file.id))
    .map((file) => ({
      id: `file-${file.id}`,
      category: "source" as const,
      title: file.title,
      meta: `${file.original_filename} · ${formatFileMeta(file)} · ${formatDate(file.created_at)}`,
      status: file.status ?? "Original file",
      file,
    }));
  const responses = fileList
    .filter((file) => file.kind === "response")
    .map((file) => ({
      id: `response-${file.id}`,
      category: "response" as const,
      title: file.title,
      meta: `${file.original_filename} · ${file.status ?? "Saved"} · ${formatDate(file.created_at)}`,
      status: file.status ?? "Saved",
      file,
    }));

  return [...converted, ...unconverted, ...responses];
}

function workspaceStateKey({ comments, documentTotalCount, documents, files, initialView, rfp }: RFPWorkspaceProps): string {
  return JSON.stringify({
    commentIds: comments.map((comment) => comment.id),
    documentIds: documents.map((document) => document.id),
    documentTotalCount,
    fileIds: files.map((file) => file.id),
    initialView,
    responseDraftSavedAt: rfp.response_draft_saved_at,
    summaryGeneratedAt: rfp.summary_generated_at,
  });
}

export function RFPWorkspace(props: RFPWorkspaceProps) {
  return <RFPWorkspaceState key={workspaceStateKey(props)} {...props} />;
}

function RFPWorkspaceState({
  comments,
  documentTotalCount: initialDocumentTotalCount,
  documents,
  files,
  initialView,
  rfp,
}: RFPWorkspaceProps) {
  // ── State ─────────────────────────────────────────────────────────────────
  const [commentList, setCommentList] = useState(comments);
  const [documentList, setDocumentList] = useState(documents);
  const [documentTotalCount, setDocumentTotalCount] = useState(initialDocumentTotalCount);
  const [fileList, setFileList] = useState(files);
  const [commentBody, setCommentBody] = useState("");
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null);
  const [summary, setSummary] = useState(rfp.summary ?? "");
  const [summaryGeneratedAt, setSummaryGeneratedAt] = useState(rfp.summary_generated_at);
  const [summaryDraft, setSummaryDraft] = useState(rfp.summary ?? "");
  const [isEditingSummary, setIsEditingSummary] = useState(false);
  const [isSavingSummary, setIsSavingSummary] = useState(false);
  const [responseTitle, setResponseTitle] = useState(rfp.response_draft_title ?? "Response draft");
  const [responseDraft, setResponseDraft] = useState(rfp.response_draft_content ?? "");
  const [responseSavedAt, setResponseSavedAt] = useState(rfp.response_draft_saved_at);
  const [isSavingResponse, setIsSavingResponse] = useState(false);
  const [responseMode, setResponseMode] = useState<"write" | "preview">("write");
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
  const [activeTab, setActiveTab] = useState<WorkspaceTab>(() => workspaceTabFromQuery(initialView ?? null));
  const [documentQuery, setDocumentQuery] = useState("");
  const [documentFilter, setDocumentFilter] = useState<"all" | "source" | "converted" | "needs-conversion">("all");
  const [showConverter, setShowConverter] = useState(false);
  const [documentMarkdown, setDocumentMarkdown] = useState<Record<string, string>>({});
  const [loadingDocumentId, setLoadingDocumentId] = useState<string | null>(null);
  const [isLoadingMoreDocuments, setIsLoadingMoreDocuments] = useState(false);
  const loadingDocumentIdsRef = useRef(new Set<string>());
  const urlReadyRef = useRef(false);

  const sourceInputRef = useRef<HTMLInputElement>(null);
  const bulkSourceInputRef = useRef<HTMLInputElement>(null);
  const responseInputRef = useRef<HTMLInputElement>(null);
  const responseFiles = fileList.filter((file) => file.kind === "response");
  const hasResponseDraft = Boolean(responseDraft.trim());
  const workspaceDocuments = useMemo(
    () => deriveWorkspaceDocuments(documentList, fileList),
    [documentList, fileList],
  );
  const visibleWorkspaceDocuments = useMemo(() => {
    const query = documentQuery.trim().toLowerCase();
    return workspaceDocuments.filter((item) => {
      const matchesQuery = !query || `${item.title} ${item.meta} ${item.status}`.toLowerCase().includes(query);
      const matchesFilter =
        documentFilter === "all" ||
        item.category === documentFilter ||
        (documentFilter === "converted" && Boolean(item.document)) ||
        (documentFilter === "needs-conversion" && item.category === "source" && !item.document);
      return matchesQuery && matchesFilter;
    });
  }, [documentFilter, documentQuery, workspaceDocuments]);
  const resolvedSelectedDocumentId = selectedDocumentId ?? workspaceDocuments.find((item) => item.category === "source")?.id ?? null;
  const selectedDocument = workspaceDocuments.find((item) => item.id === resolvedSelectedDocumentId && item.category === "source") ?? null;
  const selectedSourceDocument = selectedDocument?.document;
  const selectedPreview = selectedDocument?.document
    ? documentMarkdown[selectedDocument.document.id] ?? selectedDocument.preview
    : selectedDocument?.preview;

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (urlReadyRef.current) return;
      const params = new URLSearchParams(window.location.search);
      setActiveTab(workspaceTabFromQuery(params.get("view")));
      setSelectedDocumentId(params.get("document"));
      urlReadyRef.current = true;
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!urlReadyRef.current) return;
    const params = new URLSearchParams(window.location.search);
    params.set("view", activeTab);
    if (resolvedSelectedDocumentId) params.set("document", resolvedSelectedDocumentId);
    else params.delete("document");
    const query = params.toString();
    window.history.replaceState({}, "", `${window.location.pathname}${query ? `?${query}` : ""}`);
  }, [activeTab, resolvedSelectedDocumentId]);

  const requestDocumentMarkdown = useCallback(async (documentId: string): Promise<string> => {
    const response = await fetch(`/api/rfp/${rfp.id}/documents/${documentId}`);
    const data = await readJsonResponse<{ document?: { markdown?: string } }>(response, "Could not load document content.");
    return data.document?.markdown ?? "";
  }, [rfp.id]);

  const requestDocumentPage = useCallback(async (offset: number): Promise<{ documents: RfpDocument[]; totalCount: number }> => {
    const response = await fetch(`/api/rfp/${rfp.id}/documents?offset=${offset}&limit=25`);
    return readJsonResponse(response, "Could not load more documents.");
  }, [rfp.id]);

  async function loadMoreDocuments() {
    if (isLoadingMoreDocuments || documentList.length >= documentTotalCount) return;
    setIsLoadingMoreDocuments(true);
    try {
      const page = await requestDocumentPage(documentList.length);
      setDocumentList((current) => {
        const currentIds = new Set(current.map((document) => document.id));
        return [...current, ...page.documents.filter((document) => !currentIds.has(document.id))];
      });
      setDocumentTotalCount(page.totalCount);
    } catch (error) {
      setMessageType("error");
      setMessage(getErrorMessage(error, "Could not load more documents."));
    } finally {
      setIsLoadingMoreDocuments(false);
    }
  }

  const loadDocumentMarkdown = useCallback(async (document: RfpDocument): Promise<string> => {
    if (document.markdown) return document.markdown;
    const cached = documentMarkdown[document.id];
    if (cached !== undefined) return cached;
    if (loadingDocumentIdsRef.current.has(document.id)) return "";

    loadingDocumentIdsRef.current.add(document.id);
    setLoadingDocumentId(document.id);
    try {
      const markdown = await requestDocumentMarkdown(document.id);
      setDocumentMarkdown((current) => ({ ...current, [document.id]: markdown }));
      return markdown;
    } finally {
      loadingDocumentIdsRef.current.delete(document.id);
      setLoadingDocumentId((current) => (current === document.id ? null : current));
    }
  }, [documentMarkdown, requestDocumentMarkdown]);

  function selectDocument(id: string) {
    setSelectedDocumentId(id);
    const item = workspaceDocuments.find((candidate) => candidate.id === id);
    if (item?.document && !item.document.markdown && documentMarkdown[item.document.id] === undefined) {
      void loadDocumentMarkdown(item.document).catch((error) => {
        setMessageType("error");
        setMessage(getErrorMessage(error, "Could not load document content."));
      });
    }
  }

  useEffect(() => {
    if (!selectedSourceDocument || selectedPreview) return;
    void loadDocumentMarkdown(selectedSourceDocument).catch((error) => {
      setMessageType("error");
      setMessage(getErrorMessage(error, "Could not load document content."));
    });
  }, [loadDocumentMarkdown, selectedPreview, selectedSourceDocument]);

  // ── Handlers ──────────────────────────────────────────────────────────────
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
      setMessage(getErrorMessage(error, "Could not convert this file."));
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
      setMessage(getErrorMessage(error, "Could not add comment."));
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
      setMessage(getErrorMessage(error, "Could not delete comment."));
    }
  }

  async function removeDocument(id: string) {
    if (!window.confirm("Delete this saved markdown?")) return;
    setMessage(null);
    setMessageType("info");
    try {
      await deleteDocument(id);
      setDocumentList((current) => current.filter((document) => document.id !== id));
      setDocumentTotalCount((current) => Math.max(0, current - 1));
      if (selectedDocumentId === `document-${id}`) {
        const nextDocument = documentList.find((document) => document.id !== id);
        setSelectedDocumentId(nextDocument ? `document-${nextDocument.id}` : null);
      }
    } catch (error) {
      setMessageType("error");
      setMessage(getErrorMessage(error, "Could not delete saved markdown."));
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
      setMessage(getErrorMessage(error, "Could not create a download link."));
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
      setMessage(getErrorMessage(error, "Could not delete file."));
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
      setMessage(getErrorMessage(error, "Could not save response file."));
    } finally {
      setIsUploadingResponse(false);
    }
  }

  async function copyResponseDraft() {
    const content = responseDraft.trim();
    if (!content) return;

    try {
      await navigator.clipboard.writeText(content);
      setMessageType("info");
      setMessage("Response draft copied to clipboard.");
    } catch (error) {
      setMessageType("error");
      setMessage(getErrorMessage(error, "Could not copy response draft."));
    }
  }

  async function saveResponseDraft() {
    setIsSavingResponse(true);
    setMessage(null);
    try {
      const saved = await updateRfpResponseDraft(rfp.id, responseTitle.trim() || "Response draft", responseDraft);
      setResponseTitle(saved.response_draft_title ?? "Response draft");
      setResponseSavedAt(saved.response_draft_saved_at);
      setMessageType("info");
      setMessage("Response draft saved to the shared workspace.");
    } catch (error) {
      setMessageType("error");
      setMessage(getErrorMessage(error, "Could not save the response draft."));
    } finally {
      setIsSavingResponse(false);
    }
  }

  function exportResponseDraft() {
    const blob = new Blob([responseDraft], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${(responseTitle.trim() || "response-draft").replace(/[^a-z0-9-_]+/gi, "-")}.md`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function saveAssessment() {
    setIsSavingSummary(true);
    setMessage(null);
    try {
      const saved = await updateRfpSummary(rfp.id, summaryDraft);
      setSummary(saved.summary ?? "");
      setSummaryGeneratedAt(saved.summary_generated_at);
      setIsEditingSummary(false);
      setMessageType("info");
      setMessage("Assessment saved to the shared workspace.");
    } catch (error) {
      setMessageType("error");
      setMessage(getErrorMessage(error, "Could not save the assessment."));
    } finally {
      setIsSavingSummary(false);
    }
  }

  function addUploadedSources(saved: UploadedSourceDocument[]) {
    if (saved.length === 0) return;

    setDocumentList((current) => prependUniqueById(saved.map((item) => item.document), current));
    setDocumentTotalCount((current) => current + saved.length);
    setFileList((current) => prependUniqueById(saved.map((item) => item.sourceFile), current));
    setSelectedDocumentId(`document-${saved[0].document.id}`);
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
      addUploadedSources(saved);
      setMessage(`${saved.length} source document${saved.length === 1 ? "" : "s"} saved with converted markdown.`);
    } catch (error) {
      if (error instanceof PartialUploadError) {
        addUploadedSources(error.completed as UploadedSourceDocument[]);
      }
      setMessageType("error");
      setMessage(getErrorMessage(error, "Could not bulk upload source documents."));
    } finally {
      setIsBulkUploading(false);
      setBulkProgress("");
      if (bulkSourceInputRef.current) bulkSourceInputRef.current.value = "";
    }
  }

  async function getDocumentsForSummary(currentDocuments: RfpDocument[]): Promise<RfpDocument[]> {
    if (currentDocuments.length >= documentTotalCount) return currentDocuments;

    const allDocuments: RfpDocument[] = [];
    let offset = 0;
    let totalCount = documentTotalCount;
    while (offset < totalCount) {
      const page = await requestDocumentPage(offset);
      allDocuments.push(...page.documents);
      totalCount = page.totalCount;
      if (page.documents.length === 0) break;
      offset += page.documents.length;
    }
    return allDocuments;
  }

  async function generateSummary(documentsToSummarize = documentList) {
    if (summary && !window.confirm("Generate a new quick summary? This will replace the saved assessment text for this opportunity.")) return;
    setIsSummarizing(true);
    setMessage(null);
    setMessageType("info");
    let documentsWithMarkdown: RfpDocument[];
    try {
      const documentsForSummary = await getDocumentsForSummary(documentsToSummarize);
      documentsWithMarkdown = await Promise.all(
        documentsForSummary.map(async (document) => ({
          ...document,
          markdown: document.markdown || documentMarkdown[document.id] || (await requestDocumentMarkdown(document.id)),
        })),
      );
      setDocumentMarkdown((current) => ({
        ...current,
        ...Object.fromEntries(documentsWithMarkdown.map((document) => [document.id, document.markdown])),
      }));
    } catch (error) {
      setIsSummarizing(false);
      setMessageType("error");
      setMessage(getErrorMessage(error, "Could not load document content."));
      return;
    }

    const markdown = combineDocumentMarkdown(documentsWithMarkdown);
    if (!markdown.trim()) {
      setMessageType("error");
      setMessage("Save converted markdown before generating a summary.");
      setIsSummarizing(false);
      return;
    }
    try {
      const response = await fetch("/api/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rfp_id: rfp.id, markdown }),
      });
      const data = await readJsonResponse<{ summary: string; rfp?: { summary_generated_at?: string | null } }>(
        response,
        "Could not generate summary.",
      );
      setSummary(data.summary);
      setSummaryDraft(data.summary);
      setSummaryGeneratedAt(data.rfp?.summary_generated_at ?? new Date().toISOString());
      setMessageType("info");
      setMessage("Summary generated and autosaved.");
    } catch (error) {
      setMessageType("error");
      setMessage(getErrorMessage(error, "Could not generate summary."));
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
      setDocumentTotalCount((current) => current + 1);
      setSelectedDocumentId(`document-${saved.id}`);
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
      setMessage(getErrorMessage(error, "Could not save markdown."));
    } finally {
      setIsSavingMarkdown(false);
    }
  }

  const tabs: { id: WorkspaceTab; label: string; count?: number }[] = [
    { id: "overview", label: "Overview" },
    { id: "documents", label: "Documents", count: workspaceDocuments.filter((item) => item.category === "source").length },
    { id: "summary", label: "Assessment" },
    { id: "response", label: "Response", count: responseFiles.length },
    { id: "team", label: "Team notes", count: commentList.length },
  ];
  const documentGroups = [
    { label: "Tender material", items: visibleWorkspaceDocuments.filter((item) => item.category === "source") },
  ].filter((group) => group.items.length > 0);

  const converterPanel = showConverter ? (
    <section className="workspace-converter">
      <div className="section-heading">
        <div>
          <h3>Add or convert a document</h3>
          <p>Upload a file or paste Markdown, then save it to this RFP.</p>
        </div>
        <button className="icon-button" aria-label="Close converter" onClick={() => setShowConverter(false)} type="button">×</button>
      </div>
      <input accept={FILE_ACCEPT} hidden onChange={(event) => void handleFiles(event.target.files)} ref={sourceInputRef} type="file" />
      <div className="upload-control-row">
        <button className="button compact-button" onClick={() => sourceInputRef.current?.click()} type="button">
          {isConverting ? "Converting..." : "Upload file"}
        </button>
        <span className="document-meta">{sourceFileName || "DOCX · PDF · XLSX · CSV · MD · TXT"}</span>
      </div>
      <input className="input" onChange={(event) => setMarkdownTitle(event.target.value)} placeholder="Document title" value={markdownTitle} />
      <textarea
        className="textarea markdown-draft"
        onChange={(event) => {
          setMarkdownDraft(event.target.value);
          if (!sourceFileName) setSourceType("markdown");
        }}
        placeholder="Paste Markdown here, or upload a file above to auto-convert."
        value={markdownDraft}
      />
      <div className="form-actions">
        <button className="button" disabled={!markdownDraft.trim() || isSavingMarkdown} onClick={() => void saveMarkdown(false)} type="button">
          {isSavingMarkdown ? "Saving..." : "Save Markdown"}
        </button>
        <button className="ghost-button" disabled={!markdownDraft.trim() || isSavingMarkdown || isSummarizing} onClick={() => void saveMarkdown(true)} type="button">
          {isSavingMarkdown || isSummarizing ? "Working..." : "Save & Generate"}
        </button>
      </div>
    </section>
  ) : null;

  return (
    <aside className="workspace-panel">
      {message ? <div className={`notice workspace-notice ${messageType === "error" ? "error" : ""}`}>{message}</div> : null}
      <nav aria-label="RFP workspace" className="workspace-tabs">
        {tabs.map((tab) => (
          <button className={`workspace-tab ${activeTab === tab.id ? "active" : ""}`} key={tab.id} onClick={() => { urlReadyRef.current = true; setActiveTab(tab.id); }} type="button">
            {tab.label}
            {tab.count !== undefined ? <span className="tab-badge">{tab.count}</span> : null}
          </button>
        ))}
      </nav>

      {activeTab === "overview" ? (
        <section className="workspace-overview">
          <div className="overview-lead">
            <div>
              <h2>Work from the evidence</h2>
              <p>Collect tender material, review what it says, record the team’s bid decision, and prepare a response. You can return to any step as the tender changes.</p>
            </div>
            <button className="button" onClick={() => setActiveTab("documents")} type="button">Open documents</button>
          </div>
          <div className="overview-grid">
            <section className="overview-section">
              <h3>Next useful actions</h3>
              <div className="next-action-list">
                <button className="next-action" onClick={() => setActiveTab("documents")} type="button"><span><strong>Collect and read sources</strong><small>{fileList.filter((file) => file.kind === "source").length} original files · {documentTotalCount} readable documents saved</small></span><span>Documents →</span></button>
                <button className="next-action" onClick={() => setActiveTab("summary")} type="button"><span><strong>Assess the opportunity</strong><small>{summary ? "Saved text available to review" : "No assessment saved yet"}</small></span><span>Assessment →</span></button>
                <a className="next-action" href="#opportunity-details"><span><strong>Record the bid decision</strong><small>{rfp.status === "TBD" ? "Still undecided" : `Current decision: ${rfp.status === "Yes" ? "Bid" : "Do not bid"}`}</small></span><span>Details →</span></a>
                <button className="next-action" onClick={() => setActiveTab("response")} type="button"><span><strong>Prepare the response</strong><small>{hasResponseDraft && responseSavedAt ? `Draft saved ${formatDate(responseSavedAt)}` : "No response draft saved yet"}</small></span><span>Response →</span></button>
              </div>
            </section>
            <section className="overview-section">
              <h3>At a glance</h3>
              <dl className="overview-facts">
                <div><dt>Pipeline stage</dt><dd>{rfp.pipeline_stage}</dd></div>
                <div><dt>Bid decision</dt><dd>{rfp.status === "TBD" ? "Undecided" : rfp.status === "Yes" ? "Bid" : "Do not bid"}</dd></div>
                <div><dt>Closing date</dt><dd>{formatDateOnly(rfp.closing_date)}</dd></div>
                {rfp.closing_date_text ? <div><dt>Source deadline</dt><dd>{rfp.closing_date_text}</dd></div> : null}
                <div><dt>Readable documents</dt><dd>{documentTotalCount}</dd></div>
                <div><dt>Team notes</dt><dd>{commentList.length}</dd></div>
              </dl>
              {rfp.document_links.length > 0 ? <div className="external-links"><h4>Captured links</h4><p>External references from the tender record; opening a link does not mark it reviewed.</p>{rfp.document_links.map((link, index) => <a href={link.url} key={`${link.url}-${index}`} rel="noreferrer" target="_blank">{link.name || "External link"} ↗</a>)}</div> : null}
            </section>
          </div>
        </section>
      ) : null}

      {activeTab === "documents" ? (
        <div className="documents-workspace">
          <section aria-label="Document navigator" className="document-navigator">
            <div className="navigator-heading">
              <div><h2>Tender sources</h2><p>{documentList.length} of {documentTotalCount} readable documents loaded · original files stay paired with their text</p></div>
              <button className="ghost-button compact-button" disabled={isBulkUploading} onClick={() => bulkSourceInputRef.current?.click()} type="button">
                {isBulkUploading ? `Saving ${bulkProgress}` : "Bulk upload"}
              </button>
            </div>
            <input accept={FILE_ACCEPT} hidden multiple onChange={(event) => void bulkUploadSources(event.target.files)} ref={bulkSourceInputRef} type="file" />
            <label className="navigator-search"><input aria-label="Search documents" onChange={(event) => setDocumentQuery(event.target.value)} placeholder="Search documents" type="search" value={documentQuery} /></label>
            <div className="navigator-filters">
              <select aria-label="Filter documents" className="select" onChange={(event) => setDocumentFilter(event.target.value as typeof documentFilter)} value={documentFilter}>
                <option value="all">All sources</option><option value="source">Sources</option><option value="converted">Readable text</option><option value="needs-conversion">Needs conversion</option>
              </select>
              <button className="button compact-button" onClick={() => setShowConverter(true)} type="button">Add document</button>
            </div>
            <div className="navigator-list">
              {documentGroups.map((group) => (
                <div className="navigator-group" key={group.label}>
                  <div className="navigator-group-label">{group.label}<span>{group.items.length}</span></div>
                  {group.items.map((item) => (
                    <button aria-current={resolvedSelectedDocumentId === item.id ? "true" : undefined} className={`navigator-item ${resolvedSelectedDocumentId === item.id ? "active" : ""}`} key={item.id} onClick={() => selectDocument(item.id)} type="button">
                      <span className="file-icon">{item.document ? "MD" : "SRC"}</span>
                      <span className="document-main"><span className="document-title">{item.title}</span><span className="document-meta">{item.status} · {item.meta}</span></span>
                    </button>
                  ))}
                </div>
              ))}
              {documentList.length < documentTotalCount ? <button className="load-more-button" disabled={isLoadingMoreDocuments} onClick={() => void loadMoreDocuments()} type="button">{isLoadingMoreDocuments ? "Loading documents…" : `Load more documents (${documentTotalCount - documentList.length} remaining)`}</button> : null}
              {documentGroups.length === 0 ? <div className="empty-library">No documents match this view.</div> : null}
            </div>
          </section>

          <section aria-label="Document reader" className="document-reader">
            <div className="reader-heading">
              <div className="reader-title"><span className="drop-kicker">Tender source</span><h2>{selectedDocument?.title ?? "Select a document"}</h2><p>{selectedDocument?.meta ?? "Choose an item from the library to keep it in view."}</p></div>
              <div className="reader-actions">
                {selectedDocument?.file ? <button className="ghost-button compact-button" onClick={() => void downloadFile(selectedDocument.file!)} type="button">Download</button> : null}
                {selectedDocument?.document ? <button className="text-danger" onClick={() => void removeDocument(selectedDocument.document!.id)} type="button">Delete Markdown</button> : null}
                {selectedDocument?.file ? <button className="text-danger" onClick={() => void removeFile(selectedDocument.file!)} type="button">Delete file</button> : null}
              </div>
            </div>
            {selectedDocument?.document && loadingDocumentId === selectedDocument.document.id ? <div className="reader-empty"><strong>Loading document…</strong><p>Fetching the selected document content.</p></div> : selectedPreview ? <MarkdownReadingView className="reader-preview">{selectedPreview}</MarkdownReadingView> : selectedDocument ? <div className="reader-empty"><strong>Preview unavailable</strong><p>This item has no converted text. Use Download to view the original.</p>{selectedDocument.file ? <button className="button compact-button" onClick={() => void downloadFile(selectedDocument.file!)} type="button">Download original</button> : null}</div> : <div className="reader-empty"><strong>Your reading pane is ready</strong><p>Select a document from the library. The list and this pane scroll independently.</p></div>}
            {converterPanel}
          </section>

        </div>
      ) : null}

      {activeTab === "summary" ? (
        <section className="workspace-section workspace-secondary work-editor">
          <div className="work-editor-heading">
            <div><h2>Assessment</h2><p>{summary && summaryGeneratedAt ? `Saved ${formatDate(summaryGeneratedAt)}` : "No assessment saved yet"}</p></div>
            <button className="ghost-button compact-button" disabled={isSummarizing || isSavingSummary} onClick={() => void generateSummary()} type="button">{isSummarizing ? "Generating…" : "Generate quick summary"}</button>
          </div>
          <p className="workspace-help">Use the saved text for evidence, gaps, risks, and your recommendation. A generated quick summary may need further review before the team decides whether to bid.</p>
          {isEditingSummary || !summary ? (
            <>
              <textarea aria-label="Assessment Markdown" className="textarea" disabled={isSavingSummary} onChange={(event) => setSummaryDraft(event.target.value)} placeholder="Paste or write an evidence-based assessment in Markdown…" value={summaryDraft} />
              <div className="work-editor-actions"><button className="button" disabled={isSavingSummary || isSummarizing} onClick={() => void saveAssessment()} type="button">{isSavingSummary ? "Saving…" : "Save assessment"}</button>{summary ? <button className="ghost-button" disabled={isSavingSummary} onClick={() => { setSummaryDraft(summary); setIsEditingSummary(false); }} type="button">Cancel</button> : null}</div>
            </>
          ) : (
            <><MarkdownReadingView className="work-preview">{summary}</MarkdownReadingView><button className="ghost-button" onClick={() => setIsEditingSummary(true)} type="button">Edit assessment</button></>
          )}
        </section>
      ) : null}

      {activeTab === "response" ? (
        <section className="workspace-section workspace-secondary response-section work-editor">
          <div className="work-editor-heading"><div><h2>Response draft</h2><p>{hasResponseDraft && responseSavedAt ? `Saved ${formatDate(responseSavedAt)}` : "No draft saved yet"}</p></div><div className="view-switch"><button aria-pressed={responseMode === "write"} onClick={() => setResponseMode("write")} type="button">Write</button><button aria-pressed={responseMode === "preview"} onClick={() => setResponseMode("preview")} type="button">Preview</button></div></div>
          <p className="workspace-help">This is the shared working draft. Review claims against source documents before using it in a submission.</p>
          <input aria-label="Response draft title" className="input" disabled={isSavingResponse} onChange={(event) => setResponseTitle(event.target.value)} value={responseTitle} />
          {responseMode === "write" ? <textarea aria-label="Response draft Markdown" className="textarea" disabled={isSavingResponse} onChange={(event) => setResponseDraft(event.target.value)} placeholder="Write or paste the response draft in Markdown…" value={responseDraft} /> : <MarkdownReadingView className="work-preview">{responseDraft || "Nothing to preview yet. Switch to Write to start the draft."}</MarkdownReadingView>}
          <div className="work-editor-actions"><button className="button" disabled={isSavingResponse} onClick={() => void saveResponseDraft()} type="button">{isSavingResponse ? "Saving…" : "Save draft"}</button><button className="ghost-button" disabled={!hasResponseDraft} onClick={() => void copyResponseDraft()} type="button">Copy draft</button><button className="ghost-button" disabled={!hasResponseDraft} onClick={exportResponseDraft} type="button">Export Markdown</button></div>
          <div className="section-heading"><div><h2>Response files</h2><p>{responseFiles.length} files saved</p></div><button className="ghost-button compact-button" onClick={() => responseInputRef.current?.click()} type="button">{isUploadingResponse ? "Uploading…" : "Upload response file"}</button></div>
          <input accept={FILE_ACCEPT} hidden onChange={(event) => void uploadResponse(event.target.files)} ref={responseInputRef} type="file" />
          <textarea aria-label="Response file notes" className="textarea compact-textarea" onChange={(event) => setResponseNotes(event.target.value)} placeholder="Optional notes for the next uploaded file" value={responseNotes} />
          <div className="document-list compact-list">{responseFiles.map((file) => <article className="document-row" key={file.id}><div className="file-icon">RSP</div><span className="document-main"><span className="document-title">{file.title}</span><span className="document-meta">{file.original_filename} · {file.status ?? "Saved"} · {formatDate(file.created_at)}</span></span><button className="ghost-button compact-button" onClick={() => void downloadFile(file)} type="button">Download</button><button className="text-danger" onClick={() => void removeFile(file)} type="button">Delete</button></article>)}{responseFiles.length === 0 ? <div className="empty-library">Uploaded response files will appear here.</div> : null}</div>
        </section>
      ) : null}

      {activeTab === "team" ? <section className="workspace-section workspace-secondary"><div className="section-heading"><div><h2>Team notes</h2><p>{commentList.length} notes from the team</p></div></div><textarea className="textarea" onChange={(event) => setCommentBody(event.target.value)} placeholder="Add a comment or follow-up note" value={commentBody} /><div className="form-actions flush-actions"><button className="button" disabled={!commentBody.trim() || isPosting} onClick={() => void addComment()} type="button">{isPosting ? "Posting..." : "Add note"}</button></div><div className="comment-list">{commentList.map((comment) => <article className="comment-row" key={comment.id}><div><div className="comment-meta">{comment.author_name} · {formatDate(comment.created_at)}</div><p>{comment.body}</p></div><button className="text-danger" onClick={() => void removeComment(comment.id)} type="button">Delete</button></article>)}{commentList.length === 0 ? <div className="empty-library">Team notes will appear here.</div> : null}</div></section> : null}
    </aside>
  );
}
