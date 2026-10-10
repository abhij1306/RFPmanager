import { DocConverter } from "@/components/DocConverter";
import { listDocumentMetadataPage, type RfpDocumentPage } from "@/lib/documents";
import { getErrorMessage } from "@/lib/errors";
import { listRfpOptions, type RfpOption } from "@/lib/rfp-queries";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;

function pageNumber(value: string | undefined): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

export default async function ConvertPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const page = pageNumber((await searchParams).page);
  let rfps: RfpOption[] = [];
  let documentPage: RfpDocumentPage = { documents: [], totalCount: 0 };
  let error: string | null = null;

  try {
    [rfps, documentPage] = await Promise.all([
      listRfpOptions(),
      listDocumentMetadataPage({ limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE }),
    ]);
  } catch (loadError) {
    error = getErrorMessage(loadError, "Could not load the converter.");
  }

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Document converter</h1>
          <p>Convert one file to Markdown and attach it to any RFP. For a whole tender pack, upload on the RFP page instead.</p>
        </div>
      </header>
      {error ? <div className="notice notice-error notice-stack">{error}</div> : null}
      <DocConverter documentTotalCount={documentPage.totalCount} documents={documentPage.documents} key={page} page={page} pageSize={PAGE_SIZE} rfps={rfps} />
    </div>
  );
}
