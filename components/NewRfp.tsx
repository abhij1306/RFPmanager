"use client";

import { AlertCircle, ArrowRight, ChevronRight, FileText, UploadCloud, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { CoreRfpFields, ExtraRfpFields, cleanRfpFields, emptyRfpFields, validateRfpFields, type RfpFieldValues, type SetRfpField } from "@/components/rfp/RfpFields";
import { toast } from "@/components/ui/feedback";
import { parseTenderDate } from "@/lib/date";
import { fileExtension, formatBytes } from "@/lib/display";
import { getErrorMessage } from "@/lib/errors";
import { FILE_ACCEPT, FILE_TYPES_LABEL } from "@/lib/file-accept";
import { listDuplicateCandidates, type RfpDuplicateCandidate } from "@/lib/rfp-queries";
import { createRfp, updateRfp } from "@/lib/rfps";
import { enqueueUploads } from "@/lib/upload-queue";
import type { TenderDocumentLink } from "@/lib/types";

/* ── Bookmarklet import (payload arrives in the URL hash) ─────────────── */

const STORAGE_KEY = "rfpmanager-import-draft";
type ImportResult = { fields: RfpFieldValues | null; error: string | null; warnings: string[]; raw: string | null };
const emptyImport: ImportResult = { fields: null, error: null, warnings: [], raw: null };
let cachedRaw: string | null = null;
let cachedResult: ImportResult = emptyImport;

function stringField(value: unknown, label: string): string | null {
  if (value == null || value === "") return null;
  if (typeof value !== "string" || value.length > 10_000) throw new Error(`${label} is too long or invalid.`);
  return value.trim() || null;
}

function isHttpUrl(value: string): boolean {
  try {
    return ["http:", "https:"].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}

export function parseImport(raw: string | null): ImportResult {
  if (!raw) return emptyImport;
  try {
    if (raw.length > 60_000) throw new Error("This import is too large. Capture fewer links and try again.");
    const payload: unknown = JSON.parse(decodeURIComponent(raw.replace(/^#import=/, "")));
    if (!payload || typeof payload !== "object") throw new Error("Unsupported import format. Reinstall the bookmarklet.");
    const record = payload as Record<string, unknown>;
    if (record.version !== undefined && record.version !== 1 && record.version !== 2) throw new Error("Unsupported import format. Reinstall the bookmarklet.");
    const clientName = stringField(record.client_name, "Tender title");
    if (!clientName) throw new Error("The tender title was not captured. Let the tender page finish loading and try again.");
    const warnings = Array.isArray(record.warnings) ? record.warnings.filter((item): item is string => typeof item === "string").slice(0, 10) : [];
    const rawDeadline = stringField(record.closing_date_text, "Original deadline");
    const conflictingDates = warnings.some((warning) => /conflict/i.test(warning));
    const parsedDate = conflictingDates ? null : parseTenderDate(stringField(record.closing_date, "Closing date")) ?? parseTenderDate(rawDeadline);
    if (rawDeadline && !parsedDate) warnings.push("The closing date could not be verified. Check the original deadline before saving.");
    const tenderLink = stringField(record.tender_link, "Tender link");
    if (tenderLink && !isHttpUrl(tenderLink)) warnings.push("The tender link was left out because it is not a web address.");
    const sourceLinks = record.document_links;
    if (sourceLinks !== undefined && (!Array.isArray(sourceLinks) || sourceLinks.length > 100)) throw new Error("The import contains too many document links.");
    const seen = new Set<string>();
    const links: TenderDocumentLink[] = [];
    for (const item of (Array.isArray(sourceLinks) ? sourceLinks : []) as unknown[]) {
      if (!item || typeof item !== "object") continue;
      const value = item as Record<string, unknown>;
      const url = stringField(value.url, "Document URL");
      if (!url || !isHttpUrl(url)) continue;
      const normalized = new URL(url);
      normalized.hash = "";
      if (seen.has(normalized.href)) continue;
      seen.add(normalized.href);
      links.push({ name: stringField(value.name, "Document name") ?? "Tender document", url: normalized.href });
    }
    if (Array.isArray(record.portal_downloads) && record.portal_downloads.length) {
      warnings.push("This portal has download buttons. Download the documents and drop them into the Documents panel.");
    }
    return {
      fields: {
        ...emptyRfpFields(),
        client_name: clientName,
        closing_date: parsedDate,
        closing_date_text: rawDeadline,
        tender_code: stringField(record.tender_code, "Tender code"),
        tender_link: tenderLink && isHttpUrl(tenderLink) ? tenderLink : null,
        description: stringField(record.description, "Description"),
        contact_person: stringField(record.contact_person, "Contact person"),
        contact_phone: stringField(record.contact_phone, "Contact phone"),
        contact_email: stringField(record.contact_email, "Contact email"),
        document_links: links,
      },
      error: null,
      warnings: [...new Set(warnings)],
      raw,
    };
  } catch (error) {
    return { fields: null, error: getErrorMessage(error, "The import could not be read."), warnings: [], raw };
  }
}

function importSource(): string | null {
  if (window.location.hash.startsWith("#import=")) return window.location.hash;
  try {
    return window.sessionStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function importSnapshot(): ImportResult {
  const raw = importSource();
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cachedResult = parseImport(raw);
  }
  return cachedResult;
}

function subscribeImport(callback: () => void): () => void {
  window.addEventListener("hashchange", callback);
  window.addEventListener("rfp-import-cleared", callback);
  return () => {
    window.removeEventListener("hashchange", callback);
    window.removeEventListener("rfp-import-cleared", callback);
  };
}

function clearImport() {
  try {
    window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* Storage may be disabled. */
  }
  if (window.location.hash.startsWith("#import=")) window.history.replaceState(null, "", window.location.pathname + window.location.search);
  cachedRaw = null;
  cachedResult = emptyImport;
  window.dispatchEvent(new Event("rfp-import-cleared"));
}

function isSameTender(existing: RfpDuplicateCandidate, incoming: RfpFieldValues): boolean {
  if (!existing.tender_link || !incoming.tender_link) return false;
  try {
    const oldUrl = new URL(existing.tender_link);
    const newUrl = new URL(incoming.tender_link);
    oldUrl.hash = "";
    newUrl.hash = "";
    return oldUrl.href === newUrl.href || Boolean(existing.tender_code && incoming.tender_code && oldUrl.host === newUrl.host && existing.tender_code.toLowerCase() === incoming.tender_code.toLowerCase());
  } catch {
    return false;
  }
}

/* ── Form ─────────────────────────────────────────────────────────────── */

function NewRfpForm({ initial, warnings, onCreated }: { initial: RfpFieldValues; warnings: string[]; onCreated: () => void }) {
  const router = useRouter();
  const [values, setValues] = useState(initial);
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const hasExtras = Boolean(initial.contact_person || initial.contact_email || initial.contact_phone || initial.document_links.length);

  const setField: SetRfpField = (field, value) => setValues((current) => ({ ...current, [field]: value }));

  function addFiles(list: FileList | null) {
    const picked = Array.from(list ?? []);
    setFiles((current) => {
      const keys = new Set(current.map((file) => `${file.name}:${file.size}`));
      return [...current, ...picked.filter((file) => !keys.has(`${file.name}:${file.size}`))];
    });
  }

  async function submit(event: React.SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSaving) return;
    const cleaned = cleanRfpFields(values);
    const problem = validateRfpFields(cleaned);
    if (problem) {
      setError(problem);
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      const saved = await createRfp({
        ...cleaned,
        status: "TBD",
        pipeline_stage: "Prospects",
        summary: null,
        summary_generated_at: null,
      });
      // Uploads continue in the background while the RFP page opens and shows their progress.
      enqueueUploads(saved.id, files);
      onCreated();
      toast(files.length ? `RFP created · uploading ${files.length} file${files.length === 1 ? "" : "s"}` : "RFP created");
      router.push(`/rfp/${saved.id}`);
    } catch (saveError) {
      setError(getErrorMessage(saveError, "Could not create the RFP."));
      setIsSaving(false);
    }
  }

  const totalSize = files.reduce((sum, file) => sum + file.size, 0);

  return (
    <form
      onKeyDown={(event) => {
        if ((event.ctrlKey || event.metaKey) && event.key === "Enter") formRef.current?.requestSubmit();
      }}
      onSubmit={submit}
      ref={formRef}
    >
      {warnings.length || error ? (
        <div className="notice-stack">
          {error ? <div className="notice notice-error" role="alert"><AlertCircle size={15} />{error}</div> : null}
          {warnings.map((warning) => <div className="notice notice-warning" key={warning}><AlertCircle size={15} />{warning}</div>)}
        </div>
      ) : null}

      <div className="new-rfp">
        <div className="panel">
          <div className="panel-header"><div><h2>Tender details</h2><p>Only the name is required. Everything else can be added later.</p></div></div>
          <div className="panel-body"><CoreRfpFields autoFocus={!initial.client_name} setField={setField} values={values} /></div>
          <details className="disclosure" open={hasExtras}>
            <summary><ChevronRight size={14} />Contacts, notes and portal links</summary>
            <div className="disclosure-body"><ExtraRfpFields setField={setField} values={values} /></div>
          </details>
        </div>

        <div className="sticky-aside stack">
          <div className="panel">
            <div className="panel-header"><div><h2>Documents</h2><p>Converted to Markdown for MCP agents</p></div></div>
            <div className="panel-body">
              <input accept={FILE_ACCEPT} hidden multiple onChange={(event) => { addFiles(event.target.files); event.target.value = ""; }} ref={inputRef} type="file" />
              <button
                className="dropzone"
                data-dragging={dragging}
                onClick={() => inputRef.current?.click()}
                onDragLeave={() => setDragging(false)}
                onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
                onDrop={(event) => { event.preventDefault(); setDragging(false); addFiles(event.dataTransfer.files); }}
                type="button"
              >
                <span className="dropzone-icon"><UploadCloud size={18} /></span>
                <strong>Drop tender files here</strong>
                <span>or click to browse · {FILE_TYPES_LABEL}</span>
              </button>
              {files.length ? (
                <ul aria-label="Files to upload" className="file-list">
                  {files.map((file) => (
                    <li className="file-row" key={`${file.name}:${file.size}`}>
                      <span className="file-badge" data-type={fileExtension(file.name)}>{fileExtension(file.name)}</span>
                      <span className="file-main"><strong title={file.name}>{file.name}</strong><span>{formatBytes(file.size)}</span></span>
                      <button aria-label={`Remove ${file.name}`} className="btn btn-ghost btn-sm btn-icon" onClick={() => setFiles((current) => current.filter((item) => item !== file))} type="button"><X size={14} /></button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
            <div className="panel-footer">
              <span className="footer-note">{files.length ? `${files.length} file${files.length === 1 ? "" : "s"} · ${formatBytes(totalSize)}` : "You can also add files later"}</span>
              <button className="btn btn-primary" disabled={isSaving} type="submit">
                {isSaving ? "Creating…" : files.length ? "Create & upload" : "Create RFP"}
                <kbd className="kbd">Ctrl ↵</kbd>
              </button>
            </div>
          </div>
        </div>
      </div>
    </form>
  );
}

/* ── Page ─────────────────────────────────────────────────────────────── */

type DuplicateCheck =
  | { kind: "idle" }
  | { kind: "checking"; raw: string }
  | { kind: "done"; raw: string; duplicate: RfpDuplicateCandidate | null }
  | { kind: "failed"; raw: string };

function mergedLinks(existing: TenderDocumentLink[], incoming: TenderDocumentLink[]): TenderDocumentLink[] {
  const links = new Map<string, TenderDocumentLink>();
  for (const link of [...existing, ...incoming]) links.set(link.url, link);
  return [...links.values()];
}

export function NewRfp() {
  const router = useRouter();
  const result = useSyncExternalStore(subscribeImport, importSnapshot, () => emptyImport);
  const [check, setCheck] = useState<DuplicateCheck>({ kind: "idle" });
  const [choice, setChoice] = useState<{ raw: string | null; value: "review" | "separate" } | null>(null);
  const [isApplying, setIsApplying] = useState(false);
  const fields = result.fields;

  // Move the hash payload into session storage so a refresh keeps the draft but the URL stays clean.
  useEffect(() => {
    if (!result.raw || !window.location.hash.startsWith("#import=")) return;
    try {
      window.sessionStorage.setItem(STORAGE_KEY, result.raw);
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
    } catch {
      /* Keep the hash for refresh recovery when storage is disabled. */
    }
  }, [result.raw]);

  useEffect(() => {
    const raw = result.raw;
    if (!fields?.tender_link || !raw) return;
    let active = true;
    queueMicrotask(() => { if (active) setCheck({ kind: "checking", raw }); });
    listDuplicateCandidates().then(
      (candidates) => { if (active) setCheck({ kind: "done", raw, duplicate: candidates.find((candidate) => isSameTender(candidate, fields)) ?? null }); },
      () => { if (active) setCheck({ kind: "failed", raw }); },
    );
    return () => { active = false; };
  }, [fields, result.raw]);

  const currentChoice = choice && choice.raw === result.raw ? choice.value : null;
  const checkForThisImport = check.kind !== "idle" && check.raw === result.raw ? check : null;
  const duplicate = checkForThisImport?.kind === "done" ? checkForThisImport.duplicate : null;
  const waitingForCheck = Boolean(fields?.tender_link) && (!checkForThisImport || checkForThisImport.kind === "checking");
  const showForm = !waitingForCheck && (!duplicate || currentChoice === "separate");

  async function applyToExisting() {
    if (!duplicate || !fields) return;
    setIsApplying(true);
    try {
      await updateRfp(duplicate.id, {
        client_name: fields.client_name,
        tender_code: fields.tender_code ?? duplicate.tender_code,
        tender_link: fields.tender_link ?? duplicate.tender_link,
        closing_date: fields.closing_date ?? duplicate.closing_date,
        closing_date_text: fields.closing_date_text ?? duplicate.closing_date_text,
        description: fields.description ?? duplicate.description,
        contact_person: fields.contact_person ?? duplicate.contact_person,
        contact_phone: fields.contact_phone ?? duplicate.contact_phone,
        contact_email: fields.contact_email ?? duplicate.contact_email,
        document_links: mergedLinks(duplicate.document_links, fields.document_links),
      });
      clearImport();
      toast("Existing RFP updated");
      router.push(`/rfp/${duplicate.id}`);
    } catch (error) {
      toast(getErrorMessage(error, "Could not update the existing RFP."), "error");
      setIsApplying(false);
    }
  }

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>New RFP</h1>
          <p>{fields ? "Captured from the tender page. Check the details, add the documents, and create." : "Name the tender, drop in its documents, and you're done."}</p>
        </div>
        {fields ? <button className="btn btn-ghost" onClick={clearImport} type="button">Discard capture</button> : null}
      </header>

      {result.error ? <div className="notice notice-error notice-stack" role="alert"><AlertCircle size={15} />The capture could not be read: {result.error}</div> : null}

      {waitingForCheck ? <div className="notice notice-stack">Checking whether this tender is already saved…</div> : null}

      {checkForThisImport?.kind === "failed" && !currentChoice ? (
        <div className="notice notice-warning notice-stack"><AlertCircle size={15} />Could not check for an existing RFP. You can still create this one.</div>
      ) : null}

      {duplicate && fields && currentChoice !== "separate" ? (
        <div className="panel" style={{ marginBottom: 20 }}>
          <div className="panel-header">
            <div>
              <h2>This tender is already saved</h2>
              <p>{duplicate.client_name}{duplicate.tender_code ? ` · ${duplicate.tender_code}` : ""}</p>
            </div>
            <Link className="btn btn-secondary btn-sm" href={`/rfp/${duplicate.id}`}>Open it<ArrowRight size={14} /></Link>
          </div>
          {currentChoice === "review" ? (
            <div className="panel-body">
              <dl className="details-list" style={{ gridTemplateColumns: "140px minmax(0, 1fr) minmax(0, 1fr)" }}>
                <dt /><dd className="muted">Saved</dd><dd className="muted">Captured now</dd>
                <dt>Name</dt><dd>{duplicate.client_name}</dd><dd>{fields.client_name}</dd>
                <dt>Deadline</dt><dd>{duplicate.closing_date_text ?? duplicate.closing_date ?? "—"}</dd><dd>{fields.closing_date_text ?? fields.closing_date ?? "—"}</dd>
                <dt>Description</dt><dd>{duplicate.description ?? "—"}</dd><dd>{fields.description ?? "—"}</dd>
                <dt>Portal links</dt><dd>{duplicate.document_links.length}</dd><dd>{fields.document_links.length} (merged, nothing removed)</dd>
              </dl>
            </div>
          ) : null}
          <div className="panel-footer">
            <span className="footer-note">Updating keeps the existing documents, summary and response draft.</span>
            <button className="btn btn-ghost" onClick={() => setChoice({ raw: result.raw, value: "separate" })} type="button">Create a separate RFP</button>
            {currentChoice === "review" ? (
              <button className="btn btn-primary" disabled={isApplying} onClick={() => void applyToExisting()} type="button">{isApplying ? "Updating…" : "Apply captured details"}</button>
            ) : (
              <button className="btn btn-primary" onClick={() => setChoice({ raw: result.raw, value: "review" })} type="button">Review changes</button>
            )}
          </div>
        </div>
      ) : null}

      {showForm ? (
        <NewRfpForm initial={fields ?? emptyRfpFields()} key={result.raw ?? "blank"} onCreated={clearImport} warnings={result.warnings} />
      ) : null}

      {!fields && !result.error ? (
        <p className="list-footer" style={{ marginTop: 20 }}>
          <FileText size={13} style={{ verticalAlign: "-2px" }} /> Capturing from a tender portal? Use the <Link href="/bookmarklet" style={{ color: "var(--accent-text)" }}>capture bookmarklet</Link> to pre-fill this form.
        </p>
      ) : null}
    </div>
  );
}
