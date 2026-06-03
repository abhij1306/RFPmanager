"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { closingDateState, isClosingSoon } from "@/lib/date";
import { deleteRfp } from "@/lib/rfps";
import type { Rfp } from "@/lib/types";
import "./rfp-table.css";

type Filter = "All" | "Active" | "Submitted" | "Closing Soon";

const filters: Filter[] = ["All", "Active", "Submitted", "Closing Soon"];

function applyFilter(rfp: Rfp, filter: Filter): boolean {
  if (filter === "All") {
    return true;
  }

  if (filter === "Closing Soon") {
    return isClosingSoon(rfp.closing_date);
  }

  return rfp.pipeline_stage === filter;
}

export function RFPTable({
  commentCounts,
  documentCounts,
  rfps,
}: {
  commentCounts: Record<string, number>;
  documentCounts: Record<string, number>;
  rfps: Rfp[];
}) {
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>("All");
  const [query, setQuery] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const filteredRfps = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return rfps.filter((rfp) => {
      const matchesFilter = applyFilter(rfp, filter);
      const searchable = [rfp.client_name, rfp.tender_code, rfp.status, rfp.pipeline_stage].join(" ").toLowerCase();
      return matchesFilter && (!normalizedQuery || searchable.includes(normalizedQuery));
    });
  }, [filter, query, rfps]);

  async function onDelete(rfp: Rfp) {
    if (!window.confirm(`Delete ${rfp.client_name}?`)) {
      return;
    }

    setDeletingId(rfp.id);

    try {
      await deleteRfp(rfp.id);
      router.refresh();
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <>
      <div className="toolbar">
        <div className="filters" aria-label="RFP filters">
          {filters.map((item) => (
            <button
              className={`filter-pill ${filter === item ? "active" : ""}`}
              key={item}
              onClick={() => setFilter(item)}
              type="button"
            >
              {item}
            </button>
          ))}
        </div>
        <input
          aria-label="Search RFPs"
          className="input search-input"
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search client, tender code, status"
          value={query}
        />
      </div>

      <div className="panel table-wrap">
        <table>
          <thead>
            <tr>
              <th>Client Name</th>
              <th>Status</th>
              <th>Closing Date</th>
              <th>Tender Code</th>
              <th>Links</th>
              <th>Pipeline Stage</th>
              <th>Comments</th>
              <th>Docs</th>
              <th aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {filteredRfps.map((rfp) => {
              const dateState = closingDateState(rfp.closing_date);

              return (
                <tr key={rfp.id}>
                  <td>
                    <Link className="row-link" href={`/rfp/${rfp.id}`}>
                      {rfp.client_name}
                    </Link>
                  </td>
                  <td>
                    <span className={`status status-${rfp.status.toLowerCase()}`}>{rfp.status}</span>
                  </td>
                  <td className={dateState === "normal" ? "" : `date-${dateState}`}>{rfp.closing_date || "Not set"}</td>
                  <td>{rfp.tender_code || "-"}</td>
                  <td>
                    <div className="link-list">
                      {rfp.tender_link ? (
                        <a href={rfp.tender_link} rel="noreferrer" target="_blank">
                          Tender
                        </a>
                      ) : null}
                      {rfp.gdrive_link ? (
                        <a href={rfp.gdrive_link} rel="noreferrer" target="_blank">
                          Drive
                        </a>
                      ) : null}
                      {!rfp.tender_link && !rfp.gdrive_link ? "-" : null}
                    </div>
                  </td>
                  <td>{rfp.pipeline_stage}</td>
                  <td>
                    <Link className="count-link" href={`/rfp/${rfp.id}`}>
                      {commentCounts[rfp.id] ?? 0}
                    </Link>
                  </td>
                  <td>
                    <Link className="count-link" href={`/rfp/${rfp.id}`}>
                      {(documentCounts[rfp.id] ?? 0) + rfp.document_links.length}
                    </Link>
                  </td>
                  <td>
                    <button
                      aria-label={`Delete ${rfp.client_name}`}
                      className="icon-danger-button"
                      disabled={deletingId === rfp.id}
                      onClick={() => void onDelete(rfp)}
                      title="Delete RFP"
                      type="button"
                    >
                      <svg aria-hidden="true" fill="none" height="16" viewBox="0 0 24 24" width="16">
                        <path d="M4 7h16" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
                        <path d="M10 11v6" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
                        <path d="M14 11v6" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
                        <path d="M6 7l1 14h10l1-14" stroke="currentColor" strokeLinejoin="round" strokeWidth="2" />
                        <path d="M9 7V4h6v3" stroke="currentColor" strokeLinejoin="round" strokeWidth="2" />
                      </svg>
                    </button>
                  </td>
                </tr>
              );
            })}
            {filteredRfps.length === 0 ? (
              <tr>
                <td className="empty" colSpan={9}>
                  No RFPs match this view.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </>
  );
}
