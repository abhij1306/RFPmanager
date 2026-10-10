"use client";

import { AlertCircle, RotateCcw } from "lucide-react";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="page">
      <div className="panel">
        <div className="empty-state">
          <span className="empty-state-icon"><AlertCircle size={18} /></span>
          <h2>Something went wrong loading this page</h2>
          <p>{error.message || "The database did not respond."} Try again; if it keeps failing, check that Supabase is up.</p>
          <button className="btn btn-primary" onClick={reset} type="button"><RotateCcw size={14} />Try again</button>
        </div>
      </div>
    </div>
  );
}
