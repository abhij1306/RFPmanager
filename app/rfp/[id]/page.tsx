import { notFound } from "next/navigation";
import Link from "next/link";
import { RFPForm } from "@/components/RFPForm";
import { RFPHeaderActions } from "@/components/RFPHeaderActions";
import { RFPWorkspace } from "@/components/RFPWorkspace";
import { listCommentsByRfp } from "@/lib/comments";
import { listDocumentMetadataPage } from "@/lib/documents";
import { listFilesByRfp } from "@/lib/rfp-files";
import { formatDateOnly } from "@/lib/date";
import { getRfp } from "@/lib/rfps";
import type { RfpComment, RfpDocument, RfpFile } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function RfpDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ view?: string | string[] }> }) {
  const { id } = await params;
  const { view } = await searchParams;
  const rfp = await getRfp(id);

  if (!rfp) {
    notFound();
  }

  let documents: RfpDocument[] = [];
  let documentTotalCount = 0;
  let files: RfpFile[] = [];
  let comments: RfpComment[] = [];
  let workspaceError: string | null = null;

  try {
    const [documentPage, loadedFiles, loadedComments] = await Promise.all([
      listDocumentMetadataPage({ limit: 25, rfpId: id }),
      listFilesByRfp(id),
      listCommentsByRfp(id),
    ]);
    documents = documentPage.documents;
    documentTotalCount = documentPage.totalCount;
    files = loadedFiles;
    comments = loadedComments;
  } catch (loadError) {
    workspaceError = loadError instanceof Error ? loadError.message : "Could not load RFP workspace.";
  }

  const [displayTitle] = rfp.client_name.split(/\s+-\s+Issued by\s+/i);
  return (
    <div className="shell">
      <section className="project-hero">
        <div className="project-identity">
          <p><Link href="/">Pipeline</Link> / Opportunity</p>
          {rfp.tender_link ? (
            <a className="project-title-link" href={rfp.tender_link} rel="noreferrer" target="_blank">
              <h1>{displayTitle}</h1>
            </a>
          ) : (
            <h1>{displayTitle}</h1>
          )}
          <div className="project-status-row"><span className="stage-label">{rfp.pipeline_stage}</span><span>·</span><span>{rfp.status === "TBD" ? "Undecided" : rfp.status === "Yes" ? "Bid" : "Do not bid"}</span><span>·</span><span>{rfp.closing_date_text ? `Source deadline: ${rfp.closing_date_text}` : rfp.closing_date ? `Closes ${formatDateOnly(rfp.closing_date)}` : "No closing date set"}</span></div>
        </div>
        <RFPHeaderActions gdriveLink={rfp.gdrive_link} rfpId={rfp.id} />
      </section>
      {workspaceError ? <div className="notice error">{workspaceError}</div> : null}
      <div className="detail-layout">
        <RFPWorkspace comments={comments} documentTotalCount={documentTotalCount} documents={documents} files={files} initialView={typeof view === "string" ? view : null} rfp={rfp} />
        <div className="detail-metadata"><RFPForm collapsible={true} formId="rfp-detail-form" rfp={rfp} sourceInputId="rfp-source-upload" /></div>
      </div>
    </div>
  );
}
