"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { closingDateState, isClosingSoon } from "@/lib/date";
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

export function RFPTable({ rfps }: { rfps: Rfp[] }) {
  const [filter, setFilter] = useState<Filter>("All");
  const [query, setQuery] = useState("");

  const filteredRfps = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return rfps.filter((rfp) => {
      const matchesFilter = applyFilter(rfp, filter);
      const searchable = [rfp.client_name, rfp.tender_code, rfp.status, rfp.pipeline_stage].join(" ").toLowerCase();
      return matchesFilter && (!normalizedQuery || searchable.includes(normalizedQuery));
    });
  }, [filter, query, rfps]);

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
                </tr>
              );
            })}
            {filteredRfps.length === 0 ? (
              <tr>
                <td className="empty" colSpan={6}>
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
