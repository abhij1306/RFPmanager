import { Plus } from "lucide-react";
import Link from "next/link";
import { RfpList } from "@/components/RfpList";
import { getErrorMessage } from "@/lib/errors";
import { listRfpIndex, type RfpListItem } from "@/lib/rfp-queries";

export const dynamic = "force-dynamic";

export default async function RfpsPage() {
  let rfps: RfpListItem[] = [];
  let error: string | null = null;

  try {
    rfps = await listRfpIndex();
  } catch (loadError) {
    error = getErrorMessage(loadError, "Could not load RFPs.");
  }

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>RFPs</h1>
          <p>{rfps.length} tenders · documents are converted to Markdown for MCP agents</p>
        </div>
        <Link className="btn btn-primary" href="/rfp/new">
          <Plus size={15} />
          New RFP
        </Link>
      </header>
      {error ? <div className="notice notice-error notice-stack">{error}</div> : null}
      <RfpList rfps={rfps} />
    </div>
  );
}
