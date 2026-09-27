"use client";

import { useState } from "react";
import { buildBookmarklet, buildDebugBookmarklet } from "@/lib/bookmarklet";

export function BookmarkletInstaller({ origin }: { origin: string }) {
  const bookmarklet = origin ? buildBookmarklet(origin) : "";
  const debugBookmarklet = buildDebugBookmarklet();
  const [copyStatus, setCopyStatus] = useState("");

  async function copyBookmarklet(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopyStatus("Bookmarklet copied. Paste it into the bookmark URL field.");
    } catch {
      setCopyStatus("Copy failed. Select the code above and copy it manually.");
    }
  }

  return (
    <div className="bookmarklet-grid">
      <section className="panel bookmarklet-panel">
        <span className="drop-kicker">One-time setup</span>
        <h2>Install Extract Tender</h2>
        <p>
          Create a new browser bookmark, name it Extract Tender, and paste this JavaScript into the URL field.
        </p>
        <p>Destination: <strong>{origin || "Unavailable"}</strong>. Reinstall this bookmarklet after extraction updates.</p>
        <textarea className="markdown-preview bookmarklet-code" readOnly value={bookmarklet} />
        <div className="form-actions">
          <button className="button" disabled={!bookmarklet} onClick={() => void copyBookmarklet(bookmarklet)} type="button">
            Copy Bookmarklet
          </button>
        </div>
        {copyStatus ? <p aria-live="polite">{copyStatus}</p> : null}
      </section>

      <section className="panel bookmarklet-panel">
        <span className="drop-kicker">Workflow</span>
        <h2>Use on tender pages</h2>
        <ol className="steps-list">
          <li>Open the tender page normally in your browser.</li>
          <li>Click the Extract Tender bookmark.</li>
          <li>Review the captured details and links, then save the RFP.</li>
          <li>Download original documents from the portal, upload them here, and convert them before assessment.</li>
        </ol>
      </section>

      <section className="panel bookmarklet-panel bookmarklet-debug-panel">
        <span className="drop-kicker">Login-only portals</span>
        <h2>Install Debug Tender</h2>
        <p>
          Use this on authenticated tender pages when extraction needs tuning. Preview the diagnostic report before sharing;
          it may still contain confidential tender information.
        </p>
        <textarea className="markdown-preview bookmarklet-code bookmarklet-code-small" readOnly value={debugBookmarklet} />
        <div className="form-actions">
          <button className="button secondary-button" onClick={() => void copyBookmarklet(debugBookmarklet)} type="button">
            Copy Debug Bookmarklet
          </button>
        </div>
        {copyStatus ? <p aria-live="polite">{copyStatus}</p> : null}
      </section>
    </div>
  );
}
