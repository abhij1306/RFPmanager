"use client";

import { buildBookmarklet } from "@/lib/bookmarklet";

export function BookmarkletInstaller({ origin }: { origin: string }) {
  const bookmarklet = origin ? buildBookmarklet(origin) : "";

  async function copyBookmarklet() {
    await navigator.clipboard.writeText(bookmarklet);
  }

  return (
    <div className="bookmarklet-grid">
      <section className="panel bookmarklet-panel">
        <span className="drop-kicker">One-time setup</span>
        <h2>Install Extract Tender</h2>
        <p>
          Create a new browser bookmark, name it Extract Tender, and paste this JavaScript into the URL field.
        </p>
        <textarea className="markdown-preview bookmarklet-code" readOnly value={bookmarklet} />
        <div className="form-actions">
          <button className="button" disabled={!bookmarklet} onClick={() => void copyBookmarklet()} type="button">
            Copy Bookmarklet
          </button>
        </div>
      </section>

      <section className="panel bookmarklet-panel">
        <span className="drop-kicker">Workflow</span>
        <h2>Use on tender pages</h2>
        <ol className="steps-list">
          <li>Open the tender page normally in your browser.</li>
          <li>Click the Extract Tender bookmark.</li>
          <li>The app creates the RFP and opens its detail page.</li>
          <li>Download linked documents, convert them, then generate the summary.</li>
        </ol>
      </section>
    </div>
  );
}
