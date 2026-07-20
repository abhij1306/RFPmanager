import Link from "next/link";
import { RFPTable } from "@/components/RFPTable";
import { listCommentCountsByRfp } from "@/lib/comments";
import { listDocumentCountsByRfp } from "@/lib/documents";
import { listSourceFileCountsByRfp } from "@/lib/rfp-files";
import { listRfps } from "@/lib/rfps";
import type { Rfp } from "@/lib/types";

export const dynamic = "force-dynamic";

function mapCountsByRfpId(items: Array<{ rfp_id: string; count: number }>): Record<string, number> {
  return items.reduce<Record<string, number>>((counts, item) => {
    counts[item.rfp_id] = item.count;
    return counts;
  }, {});
}

export default async function DashboardPage() {
  let rfps: Rfp[] = [];
  let documentCounts: Record<string, number> = {};
  let fileCounts: Record<string, number> = {};
  let commentCounts: Record<string, number> = {};
  let error: string | null = null;
  let workspaceError: string | null = null;

  try {
    rfps = await listRfps();
  } catch (loadError) {
    error = loadError instanceof Error ? loadError.message : "Could not load RFPs.";
  }

  try {
    const [documentCountRows, commentCountRows, fileCountRows] = await Promise.all([
      listDocumentCountsByRfp(),
      listCommentCountsByRfp(),
      listSourceFileCountsByRfp(),
    ]);
    documentCounts = mapCountsByRfpId(documentCountRows);
    commentCounts = mapCountsByRfpId(commentCountRows);
    fileCounts = mapCountsByRfpId(fileCountRows);
  } catch (loadError) {
    workspaceError = loadError instanceof Error ? loadError.message : "Could not load RFP workspace counts.";
  }

  return (
    <div className="shell">
      <section className="page-title">
        <div>
          <h1>RFP Tracker</h1>
          <p>Shared pipeline for prospects, active bids, submissions, and outcomes.</p>
        </div>
        <Link className="button" href="/rfp/new">
          Add RFP
        </Link>
      </section>
      {error ? <div className="notice error">{error}</div> : null}
      {workspaceError ? <div className="notice error">{workspaceError}</div> : null}
      <RFPTable commentCounts={commentCounts} documentCounts={documentCounts} fileCounts={fileCounts} rfps={rfps} />
    </div>
  );
}
