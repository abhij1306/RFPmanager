"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { closingDateState, isClosingSoon } from "@/lib/date";
import { deleteRfp } from "@/lib/rfps";
import type { PipelineStage, Rfp } from "@/lib/types";

type StageFilter = "All" | "Active" | "Submitted" | "Closing Soon";
const stageFilters: StageFilter[] = ["All", "Active", "Submitted", "Closing Soon"];
const stageRank: Record<PipelineStage, number> = { Active: 0, Prospects: 0, Submitted: 1, Won: 2, Lost: 2 };

function matchesStage(rfp: Rfp, filter: StageFilter): boolean {
  if (filter === "All") return true;
  if (filter === "Active") return rfp.pipeline_stage === "Prospects" || rfp.pipeline_stage === "Active";
  if (filter === "Closing Soon") return (rfp.pipeline_stage === "Prospects" || rfp.pipeline_stage === "Active") && isClosingSoon(rfp.closing_date);
  return rfp.pipeline_stage === "Submitted";
}

function byPriority(left: Rfp, right: Rfp, today: string): number {
  const stageDifference = stageRank[left.pipeline_stage] - stageRank[right.pipeline_stage];
  if (stageDifference) return stageDifference;
  if (stageRank[left.pipeline_stage] === 0) {
    const dateGroup = (rfp: Rfp) => !rfp.closing_date ? 2 : rfp.closing_date < today ? 1 : 0;
    const urgencyDifference = dateGroup(left) - dateGroup(right);
    if (urgencyDifference) return urgencyDifference;
  }
  if (!left.closing_date) return right.closing_date ? 1 : left.client_name.localeCompare(right.client_name);
  if (!right.closing_date) return -1;
  return left.closing_date.localeCompare(right.closing_date) || left.client_name.localeCompare(right.client_name);
}

function DeleteIcon() {
  return <svg aria-hidden="true" fill="none" height="16" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24" width="16"><path d="M4 7h16M10 4h4m-8 3 1 13h10l1-13M10 11v6m4-6v6" /></svg>;
}

export function RFPTable({ documentCounts, fileCounts, rfps }: {
  documentCounts: Record<string, number>;
  fileCounts: Record<string, number>;
  rfps: Rfp[];
}) {
  const router = useRouter();
  const [stageFilter, setStageFilter] = useState<StageFilter>("All");
  const [query, setQuery] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function onDelete(rfp: Rfp) {
    if (!window.confirm(`Delete ${rfp.client_name}?`)) return;
    setDeletingId(rfp.id); setDeleteError(null);
    try { await deleteRfp(rfp.id); router.refresh(); }
    catch (error) { setDeleteError(error instanceof Error ? error.message : "Could not delete the opportunity."); }
    finally { setDeletingId(null); }
  }

  const ordered = useMemo(() => {
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    return [...rfps].sort((left, right) => byPriority(left, right, today));
  }, [rfps]);
  const filtered = useMemo(() => {
    const term = query.trim().toLocaleLowerCase();
    return ordered.filter((rfp) => matchesStage(rfp, stageFilter) && (!term || [rfp.client_name, rfp.description, rfp.tender_code, rfp.status].some((value) => value?.toLocaleLowerCase().includes(term))));
  }, [ordered, stageFilter, query]);

  const linkTitle = (rfp: Rfp) => `${rfp.client_name}\n${rfp.description || rfp.tender_code || "Open workspace"}`;
  const opportunity = (rfp: Rfp) => <Link className="pipeline-opportunity-link" href={`/rfp/${rfp.id}`} title={linkTitle(rfp)}><strong>{rfp.client_name}</strong><span>{rfp.description || rfp.tender_code || "Open workspace"}</span></Link>;
  const links = (rfp: Rfp) => <span className="pipeline-links">{rfp.tender_link ? <a href={rfp.tender_link} rel="noreferrer" target="_blank">Tender</a> : null}{rfp.gdrive_link ? <a href={rfp.gdrive_link} rel="noreferrer" target="_blank">Drive</a> : null}{!rfp.tender_link && !rfp.gdrive_link ? "–" : null}</span>;
  const deleteButton = (rfp: Rfp) => <button aria-label={`Delete ${rfp.client_name}`} className="pipeline-delete" disabled={deletingId === rfp.id} onClick={() => void onDelete(rfp)} title="Delete opportunity" type="button"><DeleteIcon /></button>;

  return <section aria-label="Opportunity pipeline">
    <div className="pipeline-controls">
      <div aria-label="Filter by pipeline stage" className="filters">{stageFilters.map((item) => <button aria-pressed={stageFilter === item} className={`filter-pill ${stageFilter === item ? "active" : ""}`} key={item} onClick={() => setStageFilter(item)} type="button">{item}</button>)}</div>
      <label className="visually-hidden-file-input" htmlFor="pipeline-search">Search opportunities</label>
      <input className="input pipeline-search" id="pipeline-search" onChange={(event) => setQuery(event.target.value)} placeholder="Search client, tender code, status" type="search" value={query} />
    </div>
    {deleteError ? <div className="notice error" role="alert">{deleteError}</div> : null}
    {rfps.length === 0 ? <div className="panel pipeline-empty"><h2>Start with an opportunity</h2><p>Add a tender to keep its decision, source documents, assessment, and response together.</p><Link className="button" href="/rfp/new">New opportunity</Link></div> : <div className="panel pipeline-list-panel">
      <div className="table-wrap"><table className="pipeline-table">
        <colgroup><col className="pipeline-opportunity-column" /><col className="pipeline-date-column" /><col className="pipeline-code-column" /><col className="pipeline-links-column" /><col className="pipeline-docs-column" /><col className="pipeline-actions-column" /></colgroup>
        <thead><tr><th>Client name</th><th>Closing date</th><th>Tender code</th><th>Links</th><th>Docs</th><th aria-label="Actions" /></tr></thead>
        <tbody>{filtered.map((rfp) => <tr key={rfp.id}>
          <td>{opportunity(rfp)}</td>
          <td className={closingDateState(rfp.closing_date) === "normal" ? "" : `date-${closingDateState(rfp.closing_date)}`} title={rfp.closing_date_text ?? undefined}>{rfp.closing_date ?? rfp.closing_date_text ?? "–"}</td>
          <td className="pipeline-code" title={rfp.tender_code ?? undefined}>{rfp.tender_code || "–"}</td>
          <td>{links(rfp)}</td>
          <td><div className="pipeline-docs"><Link className="count-badge" href={`/rfp/${rfp.id}?view=documents`}>{fileCounts[rfp.id] ?? 0} sources</Link><Link className="count-badge" href={`/rfp/${rfp.id}?view=documents`}>{documentCounts[rfp.id] ?? 0} converted</Link></div></td>
          <td><div className="pipeline-row-actions"><Link className="ghost-button pipeline-upload" href={`/rfp/${rfp.id}?view=documents`}>Upload</Link>{deleteButton(rfp)}</div></td>
        </tr>)}{filtered.length === 0 ? <tr><td className="empty" colSpan={6}>No opportunities match. Try another filter or search term.</td></tr> : null}</tbody>
      </table></div>
      <div className="pipeline-mobile-list">{filtered.map((rfp) => <article className="pipeline-mobile-item" key={rfp.id}>{opportunity(rfp)}<div className="pipeline-mobile-meta"><span className={closingDateState(rfp.closing_date) === "normal" ? "" : `date-${closingDateState(rfp.closing_date)}`}>{rfp.closing_date || rfp.closing_date_text ? `Closes ${rfp.closing_date ?? rfp.closing_date_text}` : "No closing date"}</span><span>{rfp.tender_code || "No tender code"}</span></div><div className="pipeline-mobile-links">{links(rfp)}<Link href={`/rfp/${rfp.id}?view=documents`}>{fileCounts[rfp.id] ?? 0} sources · {documentCounts[rfp.id] ?? 0} converted</Link>{deleteButton(rfp)}</div></article>)}{filtered.length === 0 ? <p className="pipeline-mobile-empty">No opportunities match. Try another filter or search term.</p> : null}</div>
    </div>}
  </section>;
}
