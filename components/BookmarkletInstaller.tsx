"use client";

import { Copy } from "lucide-react";
import { toast } from "@/components/ui/feedback";
import { buildBookmarklet, buildDebugBookmarklet } from "@/lib/bookmarklet";

async function copy(value: string) {
  try {
    await navigator.clipboard.writeText(value);
    toast("Bookmarklet copied. Paste it into a new bookmark's URL field.");
  } catch {
    toast("Copy failed. Select the code and copy it manually.", "error");
  }
}

export function BookmarkletInstaller({ origin }: { origin: string }) {
  const bookmarklet = origin ? buildBookmarklet(origin) : "";
  const debugBookmarklet = buildDebugBookmarklet();

  return (
    <div className="new-rfp">
      <div className="stack">
        <div className="panel">
          <div className="panel-header">
            <div><h2>Extract Tender</h2><p>Sends captures to {origin || "this app"}</p></div>
            <button className="btn btn-primary btn-sm" disabled={!bookmarklet} onClick={() => void copy(bookmarklet)} type="button"><Copy size={14} />Copy bookmarklet</button>
          </div>
          <div className="panel-body stack">
            <p className="muted">Create a bookmark named “Extract Tender” and paste this into its URL field. Reinstall after app updates.</p>
            <textarea aria-label="Extract Tender bookmarklet code" className="code-block" readOnly value={bookmarklet} />
          </div>
        </div>
        <div className="panel">
          <div className="panel-header">
            <div><h2>Debug Tender</h2><p>For login-only portals where extraction needs tuning</p></div>
            <button className="btn btn-secondary btn-sm" onClick={() => void copy(debugBookmarklet)} type="button"><Copy size={14} />Copy</button>
          </div>
          <div className="panel-body stack">
            <p className="muted">The diagnostic report can contain confidential tender text. Read it before sharing.</p>
            <textarea aria-label="Debug Tender bookmarklet code" className="code-block" readOnly value={debugBookmarklet} />
          </div>
        </div>
      </div>
      <div className="panel sticky-aside">
        <div className="panel-header"><h2>How to use it</h2></div>
        <div className="panel-body">
          <ol className="steps">
            <li>Open the tender page in your browser.</li>
            <li>Click the Extract Tender bookmark.</li>
            <li>Check the pre-filled details on the New RFP page.</li>
            <li>Download the tender documents from the portal and drop them into the Documents panel.</li>
            <li>Create. Agents can read the converted documents over MCP right away.</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
