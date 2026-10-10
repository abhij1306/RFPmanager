import { notFound } from "next/navigation";
import { RfpDetail } from "@/components/rfp/RfpDetail";
import { listDocumentMetadataPage } from "@/lib/documents";
import { listFilesByRfp } from "@/lib/rfp-files";
import { getRfp } from "@/lib/rfps";

export const dynamic = "force-dynamic";

const DOCUMENT_PAGE_SIZE = 200;

export default async function RfpPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ view?: string | string[] }>;
}) {
  const [{ id }, { view }] = await Promise.all([params, searchParams]);
  // One parallel round trip: the record, its document metadata (no Markdown bodies), and its files.
  const [rfp, documentPage, files] = await Promise.all([
    getRfp(id),
    listDocumentMetadataPage({ limit: DOCUMENT_PAGE_SIZE, rfpId: id }),
    listFilesByRfp(id),
  ]);

  if (!rfp) notFound();

  return (
    <RfpDetail
      documentTotalCount={documentPage.totalCount}
      documents={documentPage.documents}
      files={files}
      initialView={typeof view === "string" ? view : null}
      key={rfp.id}
      rfp={rfp}
    />
  );
}
