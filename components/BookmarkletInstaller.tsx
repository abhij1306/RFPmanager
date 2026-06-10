"use client";

import { buildBookmarklet, buildDebugBookmarklet } from "@/lib/bookmarklet";

export function BookmarkletInstaller({ origin }: { origin: string }) {
  const bookmarklet = origin ? buildBookmarklet(origin) : "";
  const debugBookmarklet = buildDebugBookmarklet();

  async function copyBookmarklet(value: string) {
    await navigator.clipboard.writeText(value);
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
          <button className="button" disabled={!bookmarklet} onClick={() => void copyBookmarklet(bookmarklet)} type="button">
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

      <section className="panel bookmarklet-panel bookmarklet-debug-panel">
        <span className="drop-kicker">Login-only portals</span>
        <h2>Install Debug Tender</h2>
        <p>
          Use this on authenticated tender pages when extraction needs tuning. It copies a redacted page-structure report
          that can be pasted into a JSON file.
        </p>
        <textarea className="markdown-preview bookmarklet-code bookmarklet-code-small" readOnly value={debugBookmarklet} />
        <div className="form-actions">
          <button className="button secondary-button" onClick={() => void copyBookmarklet(debugBookmarklet)} type="button">
            Copy Debug Bookmarklet
          </button>
        </div>
      </section>
    </div>
  );
}
