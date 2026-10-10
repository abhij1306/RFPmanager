import { FileQuestion } from "lucide-react";
import Link from "next/link";

export default function NotFound() {
  return (
    <div className="page">
      <div className="panel">
        <div className="empty-state">
          <span className="empty-state-icon"><FileQuestion size={18} /></span>
          <h2>RFP not found</h2>
          <p>It may have been deleted, or the link is wrong.</p>
          <Link className="btn btn-primary" href="/">Back to RFPs</Link>
        </div>
      </div>
    </div>
  );
}
