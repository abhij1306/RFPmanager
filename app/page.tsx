import Link from "next/link";
import { RFPTable } from "@/components/RFPTable";
import { listComments } from "@/lib/comments";
import { listDocuments } from "@/lib/documents";
import { listRfps } from "@/lib/rfps";
import type { Rfp, RfpComment, RfpDocument } from "@/lib/types";

export const dynamic = "force-dynamic";

function countByRfpId(items: Array<{ rfp_id: string }>): Record<string, number> {
  return items.reduce<Record<string, number>>((counts, item) => {
    counts[item.rfp_id] = (counts[item.rfp_id] ?? 0) + 1;
    return counts;
  }, {});
}

export default async function DashboardPage() {
  let rfps: Rfp[] = [];
  let documents: RfpDocument[] = [];
  let comments: RfpComment[] = [];
  let error: string | null = null;
  let workspaceError: string | null = null;

  try {
    rfps = await listRfps();
  } catch (loadError) {
    error = loadError instanceof Error ? loadError.message : "Could not load RFPs.";
  }

  try {
    [documents, comments] = await Promise.all([listDocuments(), listComments()]);
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
      <RFPTable commentCounts={countByRfpId(comments)} documentCounts={countByRfpId(documents)} rfps={rfps} />
    </div>
  );
}
