import { notFound } from "next/navigation";
import { RFPForm } from "@/components/RFPForm";
import { RFPWorkspace } from "@/components/RFPWorkspace";
import { listCommentsByRfp } from "@/lib/comments";
import { listDocumentsByRfp } from "@/lib/documents";
import { getRfp } from "@/lib/rfps";
import type { RfpComment, RfpDocument } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function RfpDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const rfp = await getRfp(id);

  if (!rfp) {
    notFound();
  }

  let documents: RfpDocument[] = [];
  let comments: RfpComment[] = [];
  let workspaceError: string | null = null;

  try {
    [documents, comments] = await Promise.all([listDocumentsByRfp(id), listCommentsByRfp(id)]);
  } catch (loadError) {
    workspaceError = loadError instanceof Error ? loadError.message : "Could not load RFP workspace.";
  }

  return (
    <div className="shell">
      <section className="page-title">
        <div>
          <h1>{rfp.client_name}</h1>
          <p>Edit links, status, dates, and team notes for this RFP.</p>
        </div>
      </section>
      {workspaceError ? <div className="notice error">{workspaceError}</div> : null}
      <div className="detail-layout">
        <RFPForm rfp={rfp} />
        <RFPWorkspace comments={comments} documents={documents} rfp={rfp} />
      </div>
    </div>
  );
}
