import { NextResponse } from "next/server";
import { getDocumentByRfp } from "@/lib/documents";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; documentId: string }> },
) {
  const { id, documentId } = await params;
  const document = await getDocumentByRfp(id, documentId);

  if (!document) {
    return NextResponse.json({ error: "Document not found for this RFP." }, { status: 404 });
  }

  return NextResponse.json({ document: { id: document.id, markdown: document.markdown } });
}
