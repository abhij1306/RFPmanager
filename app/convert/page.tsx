import { DocConverter } from "@/components/DocConverter";
import { listDocuments } from "@/lib/documents";
import { listRfps } from "@/lib/rfps";
import type { Rfp, RfpDocument } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function ConvertPage() {
  let documents: RfpDocument[] = [];
  let rfps: Rfp[] = [];
  let error: string | null = null;
  let libraryError: string | null = null;

  try {
    rfps = await listRfps();
  } catch (loadError) {
    error = loadError instanceof Error ? loadError.message : "Could not load RFPs.";
  }

  try {
    documents = await listDocuments();
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
      <DocConverter documents={documents} rfps={rfps} />
    </div>
  );
}
