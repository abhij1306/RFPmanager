import { notFound } from "next/navigation";
import { RFPForm } from "@/components/RFPForm";
import { RFPHeaderActions } from "@/components/RFPHeaderActions";
import { RFPWorkspace } from "@/components/RFPWorkspace";
import { listCommentsByRfp } from "@/lib/comments";
import { listDocumentsByRfp } from "@/lib/documents";
import { listFilesByRfp } from "@/lib/rfp-files";
import { getRfp } from "@/lib/rfps";
import type { RfpComment, RfpDocument, RfpFile } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function RfpDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const rfp = await getRfp(id);

  if (!rfp) {
    notFound();
  }

  let documents: RfpDocument[] = [];
  let files: RfpFile[] = [];
  let comments: RfpComment[] = [];
  let workspaceError: string | null = null;

  try {
    [documents, files, comments] = await Promise.all([listDocumentsByRfp(id), listFilesByRfp(id), listCommentsByRfp(id)]);
  } catch (loadError) {
    workspaceError = loadError instanceof Error ? loadError.message : "Could not load RFP workspace.";
  }

  const [displayTitle, issuedBy] = rfp.client_name.split(/\s+-\s+Issued by\s+/i);
  const formId = "rfp-detail-form";

  return (
    <div className="shell">
      <section className="project-hero">
        <div>
          <h1>{displayTitle}</h1>
          <p>
            {[issuedBy ? `Issued by ${issuedBy}` : null, rfp.tender_code ? `Tender ${rfp.tender_code}` : null]
              .filter(Boolean)
              .join(" · ") || "Edit links, status, dates, and team notes for this RFP."}
          </p>
        </div>
        <RFPHeaderActions formId={formId} gdriveLink={rfp.gdrive_link} rfpId={rfp.id} tenderLink={rfp.tender_link} />
      </section>
      {workspaceError ? <div className="notice error">{workspaceError}</div> : null}
      <div className="detail-layout">
        <RFPForm formId={formId} rfp={rfp} />
        <RFPWorkspace comments={comments} documents={documents} files={files} rfp={rfp} />
      </div>
    </div>
  );
}
