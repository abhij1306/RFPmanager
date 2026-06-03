import Link from "next/link";
import { RFPTable } from "@/components/RFPTable";
import { listRfps } from "@/lib/rfps";
import type { Rfp } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  let rfps: Rfp[] = [];
  let error: string | null = null;

  try {
    rfps = await listRfps();
  } catch (loadError) {
    error = loadError instanceof Error ? loadError.message : "Could not load RFPs.";
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
      <RFPTable rfps={rfps} />
    </div>
  );
}
