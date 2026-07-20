import { DocConverter } from "@/components/DocConverter";
import { listDocumentMetadataPage } from "@/lib/documents";
import { listRfps } from "@/lib/rfps";
import type { Rfp, RfpDocument } from "@/lib/types";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;

function pageNumber(value: string | undefined): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

export default async function ConvertPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const { page: pageValue } = await searchParams;
  const page = pageNumber(pageValue);
  let documents: RfpDocument[] = [];
  let documentTotalCount = 0;
  let rfps: Rfp[] = [];
  let error: string | null = null;
  let libraryError: string | null = null;

  try {
    rfps = await listRfps();
  } catch (loadError) {
    error = loadError instanceof Error ? loadError.message : "Could not load RFPs.";
  }

  try {
    const documentPage = await listDocumentMetadataPage({ limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE });
    documents = documentPage.documents;
    documentTotalCount = documentPage.totalCount;
  } catch (loadError) {
    libraryError = loadError instanceof Error ? loadError.message : "Could not load saved Markdown library.";
  }

  return (
    <div className="shell">
      <section className="page-title">
        <div>
          <h1>Document Converter</h1>
          <p>Convert documents or spreadsheets to Markdown, then save the output with the right RFP.</p>
        </div>
      </section>
      {error ? <div className="notice error">{error}</div> : null}
      {libraryError ? <div className="notice error">{libraryError}</div> : null}
      <DocConverter documentTotalCount={documentTotalCount} documents={documents} page={page} pageSize={PAGE_SIZE} rfps={rfps} />
    </div>
  );
}
