"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import { RFPForm } from "@/components/RFPForm";
import { parseTenderDate } from "@/lib/date";
import { listRfps, updateRfp } from "@/lib/rfps";
import type { Rfp, RfpInput, TenderDocumentLink } from "@/lib/types";

const STORAGE_KEY = "rfpmanager-import-draft";
type ImportResult = { input: RfpInput | null; error: string | null; warnings: string[]; raw: string | null };
let cachedRaw: string | null = null;
let cachedResult: ImportResult = { input: null, error: null, warnings: [], raw: null };

function stringField(value: unknown, label: string): string | null {
  if (value == null || value === "") return null;
  if (typeof value !== "string" || value.length > 10_000) throw new Error(`${label} is too long or invalid.`);
  return value.trim() || null;
}

function httpUrl(value: string): boolean {
  try { return ["http:", "https:"].includes(new URL(value).protocol); } catch { return false; }
}

function parseImport(raw: string | null): ImportResult {
  if (!raw) return { input: null, error: null, warnings: [], raw: null };
  try {
    if (raw.length > 60_000) throw new Error("This import is too large. Capture fewer links and try again.");
    const payload = JSON.parse(decodeURIComponent(raw.replace(/^#import=/, ""))) as Record<string, unknown>;
    if (!payload || typeof payload !== "object" || (payload.version !== undefined && payload.version !== 1 && payload.version !== 2)) throw new Error("Unsupported import format. Reinstall the bookmarklet.");
    const clientName = stringField(payload.client_name, "Opportunity title");
    if (!clientName) throw new Error("The tender title was not captured. Check that the tender page has finished loading and try again.");
    const warnings = Array.isArray(payload.warnings) ? payload.warnings.filter((item): item is string => typeof item === "string").slice(0, 10) : [];
    const rawDeadline = stringField(payload.closing_date_text, "Original deadline");
    const conflictingDates = warnings.some((warning) => /conflict/i.test(warning));
    const parsedDate = conflictingDates ? null : parseTenderDate(stringField(payload.closing_date, "Closing date")) ?? parseTenderDate(rawDeadline);
    if (rawDeadline && !parsedDate) warnings.push("The closing date could not be verified. Check the original deadline before saving.");
    const tenderLink = stringField(payload.tender_link, "Tender link");
    if (tenderLink && !httpUrl(tenderLink)) warnings.push("The tender link was omitted because it is not an HTTP or HTTPS URL.");
    const sourceLinks = payload.document_links;
    if (sourceLinks !== undefined && (!Array.isArray(sourceLinks) || sourceLinks.length > 100)) throw new Error("The import contains too many document links.");
    const seen = new Set<string>();
    const links: TenderDocumentLink[] = [];
    for (const item of (sourceLinks ?? []) as unknown[]) {
      if (!item || typeof item !== "object") { warnings.push("An invalid document link was omitted."); continue; }
      const value = item as Record<string, unknown>;
      const url = stringField(value.url, "Document URL");
      if (!url || !httpUrl(url)) { warnings.push("A non-web document link was omitted."); continue; }
      const normalized = new URL(url); normalized.hash = "";
      if (seen.has(normalized.href)) continue;
      seen.add(normalized.href);
      links.push({ name: stringField(value.name, "Document name") ?? "Tender document", url: normalized.href });
    }
    if (Array.isArray(payload.portal_downloads) && payload.portal_downloads.length) warnings.push("This page has download controls that may require you to download from the portal and upload files here.");
    const input: RfpInput = {
      client_name: clientName, status: "TBD", closing_date: parsedDate,
      closing_date_text: rawDeadline, tender_code: stringField(payload.tender_code, "Tender code"),
      tender_link: tenderLink && httpUrl(tenderLink) ? tenderLink : null, gdrive_link: null,
      description: stringField(payload.description, "Description"),
      contact_person: stringField(payload.contact_person, "Contact person"),
      contact_phone: stringField(payload.contact_phone, "Contact phone"),
      contact_email: stringField(payload.contact_email, "Contact email"),
      document_links: links, summary: null, summary_generated_at: null,
      response_draft_title: null, response_draft_content: null, response_draft_saved_at: null,
      notes: null, pipeline_stage: "Prospects",
    };
    return { input, error: null, warnings: [...new Set(warnings)], raw };
  } catch (error) {
    return { input: null, error: error instanceof Error ? error.message : "Import could not be read.", warnings: [], raw };
  }
}

function importSource(): string | null {
  if (window.location.hash.startsWith("#import=")) return window.location.hash;
  try { return window.sessionStorage.getItem(STORAGE_KEY); } catch { return null; }
}

function snapshot(): ImportResult {
  const raw = importSource();
  if (raw !== cachedRaw) { cachedRaw = raw; cachedResult = parseImport(raw); }
  return cachedResult;
}

function subscribe(callback: () => void): () => void {
  window.addEventListener("hashchange", callback);
  window.addEventListener("rfp-import-cleared", callback);
  return () => { window.removeEventListener("hashchange", callback); window.removeEventListener("rfp-import-cleared", callback); };
}

function sameOpportunity(existing: Rfp, incoming: RfpInput): boolean {
  if (!existing.tender_link || !incoming.tender_link) return false;
  try {
    const oldUrl = new URL(existing.tender_link);
    const newUrl = new URL(incoming.tender_link);
    oldUrl.hash = ""; newUrl.hash = "";
    return oldUrl.href === newUrl.href || Boolean(existing.tender_code && incoming.tender_code && oldUrl.host === newUrl.host && existing.tender_code.toLowerCase() === incoming.tender_code.toLowerCase());
  } catch { return false; }
}

function mergedLinks(existing: TenderDocumentLink[], incoming: TenderDocumentLink[]): TenderDocumentLink[] {
  const links = new Map<string, TenderDocumentLink>();
  for (const link of [...existing, ...incoming]) links.set(link.url, link);
  return [...links.values()];
}

export function RFPImportDraft() {
  const router = useRouter();
  const result = useSyncExternalStore(subscribe, snapshot, () => cachedResult);
  const [duplicate, setDuplicate] = useState<Rfp | null>(null);
  const [checkState, setCheckState] = useState<"idle" | "ready" | "error">("idle");
  const [checkedRaw, setCheckedRaw] = useState<string | null>(null);
  const [choice, setChoice] = useState<"review" | "separate" | null>(null);
  const [choiceRaw, setChoiceRaw] = useState<string | null>(null);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [isApplying, setIsApplying] = useState(false);

  useEffect(() => {
    if (!result.raw || !window.location.hash.startsWith("#import=")) return;
    try {
      window.sessionStorage.setItem(STORAGE_KEY, result.raw);
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
    } catch { /* Keep the hash available for refresh recovery when storage is disabled. */ }
  }, [result.raw]);

  useEffect(() => {
    if (!result.input?.tender_link) return;
    let active = true;
    void listRfps().then((rfps) => {
      if (!active) return;
      setDuplicate(rfps.find((rfp) => sameOpportunity(rfp, result.input!)) ?? null);
      setCheckedRaw(result.raw);
      setCheckState("ready");
    }).catch(() => { if (active) { setCheckedRaw(result.raw); setCheckState("error"); } });
    return () => { active = false; };
  }, [result.input, result.raw]);

  const currentCheckState = checkedRaw === result.raw ? checkState : "checking";
  const currentChoice = choiceRaw === result.raw ? choice : null;

  function choose(value: "review" | "separate" | null) { setChoiceRaw(result.raw); setChoice(value); }

  function clearDraft() {
    try { window.sessionStorage.removeItem(STORAGE_KEY); } catch { /* Storage may be disabled. */ }
    if (window.location.hash.startsWith("#import=")) window.history.replaceState(null, "", window.location.pathname + window.location.search);
    cachedRaw = null;
    cachedResult = { input: null, error: null, warnings: [], raw: null };
    window.dispatchEvent(new Event("rfp-import-cleared"));
  }

  async function applyIncoming() {
    if (!duplicate || !result.input) return;
    setIsApplying(true); setUpdateError(null);
    try {
      const incoming = result.input;
      await updateRfp(duplicate.id, {
        client_name: incoming.client_name,
        tender_code: incoming.tender_code ?? duplicate.tender_code,
        tender_link: incoming.tender_link ?? duplicate.tender_link,
        closing_date: incoming.closing_date ?? duplicate.closing_date,
        closing_date_text: incoming.closing_date_text ?? duplicate.closing_date_text,
        description: incoming.description ?? duplicate.description,
        contact_person: incoming.contact_person ?? duplicate.contact_person,
        contact_phone: incoming.contact_phone ?? duplicate.contact_phone,
        contact_email: incoming.contact_email ?? duplicate.contact_email,
        document_links: mergedLinks(duplicate.document_links, incoming.document_links),
      });
      clearDraft();
      router.push(`/rfp/${duplicate.id}`); router.refresh();
    } catch (error) {
      setUpdateError(error instanceof Error ? error.message : "Could not update the opportunity.");
    } finally { setIsApplying(false); }
  }

  return <>
    {result.error ? <div className="notice error" role="alert">Import could not be read: {result.error}</div> : null}
    {result.warnings.map((warning) => <div className="notice" key={warning}>{warning}</div>)}
    {result.input?.tender_link && currentCheckState === "checking" ? <div className="notice">Checking for an existing opportunity…</div> : null}
    {result.input?.tender_link && currentCheckState === "error" && !currentChoice ? <div className="notice error">Could not check for an existing opportunity. <button className="ghost-button" onClick={() => choose("separate")} type="button">Create separately</button></div> : null}
    {currentCheckState === "ready" && duplicate && !currentChoice ? <div className="panel import-duplicate"><h2>Existing opportunity found</h2><p><strong>{duplicate.client_name}</strong> · {duplicate.tender_code ?? "No tender code"}</p><p>Saved deadline: {duplicate.closing_date_text ?? duplicate.closing_date ?? "None"}<br />Captured deadline: {result.input?.closing_date_text ?? result.input?.closing_date ?? "None"}</p><div className="form-actions"><Link className="ghost-button" href={`/rfp/${duplicate.id}`}>Open existing</Link><button className="button" onClick={() => choose("review")} type="button">Review incoming changes</button><button className="ghost-button" onClick={() => choose("separate")} type="button">Create separately</button></div></div> : null}
    {currentCheckState === "ready" && duplicate && currentChoice === "review" && result.input ? <div className="panel import-duplicate"><h2>Review captured details</h2><dl><dt>Title</dt><dd>Saved: {duplicate.client_name}<br />Captured: {result.input.client_name}</dd><dt>Deadline</dt><dd>Saved: {duplicate.closing_date_text ?? duplicate.closing_date ?? "None"}<br />Captured: {result.input.closing_date_text ?? result.input.closing_date ?? "None"}</dd><dt>Description</dt><dd>Saved: {duplicate.description ?? "None"}<br />Captured: {result.input.description ?? "None"}</dd><dt>Links</dt><dd>{result.input.document_links.length} captured; existing links will be kept.</dd></dl><p>Applying these details keeps the bid decision, summary, response draft, and notes.</p>{updateError ? <div className="notice error">{updateError}</div> : null}<div className="form-actions"><button className="button" disabled={isApplying} onClick={() => void applyIncoming()} type="button">{isApplying ? "Applying…" : "Apply captured details"}</button><button className="ghost-button" onClick={() => choose(null)} type="button">Back</button></div></div> : null}
    {(!result.input?.tender_link || currentCheckState === "ready" && (!duplicate || currentChoice === "separate") || currentChoice === "separate") ? <RFPForm initialInput={result.input ?? undefined} key={result.raw ?? "empty"} onCreateComplete={clearDraft} /> : null}
  </>;
}
