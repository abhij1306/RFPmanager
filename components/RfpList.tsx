"use client";

import { FileText, Inbox, Plus, Search } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { closingInfo, displayTitle, formatRelativeTime } from "@/lib/display";
import type { RfpListItem } from "@/lib/rfp-queries";

type SortKey = "recent" | "closing";

function byClosing(left: RfpListItem, right: RfpListItem, today: string): number {
  // Upcoming first (soonest at top), then past, then undated.
  const rank = (rfp: RfpListItem) => (!rfp.closing_date ? 2 : rfp.closing_date < today ? 1 : 0);
  const difference = rank(left) - rank(right);
  if (difference) return difference;
  if (!left.closing_date || !right.closing_date) return right.created_at.localeCompare(left.created_at);
  return rank(left) === 1 ? right.closing_date.localeCompare(left.closing_date) : left.closing_date.localeCompare(right.closing_date);
}

function todayIso(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function Closing({ rfp }: { rfp: RfpListItem }) {
  const info = closingInfo(rfp.closing_date, rfp.closing_date_text);
  if (info.kind === "none") return <span className="muted">—</span>;
  if (info.kind === "text") return <span className="closing-text" title={info.label}>{info.label}</span>;
  return (
    <span className="closing tabular" data-urgency={info.urgency} suppressHydrationWarning>
      {info.label}
      <small suppressHydrationWarning>{info.relative}</small>
    </span>
  );
}

export function RfpList({ rfps }: { rfps: RfpListItem[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("recent");
  const [activeIndex, setActiveIndex] = useState(-1);
  const searchRef = useRef<HTMLInputElement>(null);

  const visible = useMemo(() => {
    const term = query.trim().toLowerCase();
    const filtered = term
      ? rfps.filter((rfp) => `${rfp.client_name} ${rfp.tender_code ?? ""}`.toLowerCase().includes(term))
      : rfps;
    if (sort === "recent") return filtered;
    const today = todayIso();
    return [...filtered].sort((left, right) => byClosing(left, right, today));
  }, [query, rfps, sort]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target;
      const typing = target instanceof HTMLElement && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);
      if (event.key === "/" && !typing) {
        event.preventDefault();
        searchRef.current?.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function onSearchKey(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((current) => Math.min(current + 1, visible.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((current) => Math.max(current - 1, 0));
    } else if (event.key === "Enter") {
      const target = visible[activeIndex >= 0 ? activeIndex : 0];
      if (target) router.push(`/rfp/${target.id}`);
    } else if (event.key === "Escape") {
      setQuery("");
      setActiveIndex(-1);
    }
  }

  if (rfps.length === 0) {
    return (
      <div className="rfp-table">
        <div className="empty-state">
          <span className="empty-state-icon"><Inbox size={18} /></span>
          <h2>No RFPs yet</h2>
          <p>Create an RFP and drop in its tender documents. They are converted to Markdown so MCP agents can read them.</p>
          <Link className="btn btn-primary" href="/rfp/new"><Plus size={15} />New RFP</Link>
        </div>
      </div>
    );
  }

  return (
    <section aria-label="RFPs">
      <div className="list-toolbar">
        <label className="input-with-icon">
          <span className="sr-only">Search RFPs</span>
          <Search size={15} />
          <input
            className="input"
            onChange={(event) => { setQuery(event.target.value); setActiveIndex(-1); }}
            onKeyDown={onSearchKey}
            placeholder="Filter by name or tender code"
            ref={searchRef}
            type="search"
            value={query}
          />
          {query ? null : <kbd className="kbd">/</kbd>}
        </label>
        <div aria-label="Sort RFPs" className="segmented" role="group">
          <button aria-pressed={sort === "recent"} onClick={() => setSort("recent")} type="button">Recently added</button>
          <button aria-pressed={sort === "closing"} onClick={() => setSort("closing")} type="button">Closing date</button>
        </div>
      </div>

      <div className="rfp-table" role="table" aria-label="RFP list">
        <div className="rfp-table-head" role="row">
          <span role="columnheader">Name</span>
          <span role="columnheader">Closes</span>
          <span className="num" role="columnheader">Documents</span>
          <span className="num" role="columnheader">Added</span>
        </div>
        {visible.map((rfp, index) => (
          <Link
            className="rfp-row"
            data-active={index === activeIndex}
            href={`/rfp/${rfp.id}`}
            key={rfp.id}
            role="row"
          >
            <span className="rfp-row-title" role="cell">
              <strong title={rfp.client_name}>{displayTitle(rfp.client_name)}</strong>
              <span>{rfp.tender_code || "No tender code"}</span>
            </span>
            <span role="cell"><Closing rfp={rfp} /></span>
            <span className="num" role="cell">
              <span className="doc-count tabular" data-empty={rfp.document_count === 0}>
                <FileText size={14} />
                {rfp.document_count}
              </span>
            </span>
            <span className="added tabular" role="cell" suppressHydrationWarning>{formatRelativeTime(rfp.created_at)}</span>
          </Link>
        ))}
        {visible.length === 0 ? (
          <div className="empty-state">
            <h2>No matches</h2>
            <p>Nothing matches “{query}”. Try a tender code or part of the name.</p>
          </div>
        ) : null}
      </div>
      <p className="list-footer">
        {visible.length === rfps.length ? `${rfps.length} RFPs` : `${visible.length} of ${rfps.length} RFPs`} · Press <kbd className="kbd">/</kbd> to filter, <kbd className="kbd">↑</kbd><kbd className="kbd">↓</kbd> then <kbd className="kbd">Enter</kbd> to open
      </p>
    </section>
  );
}
