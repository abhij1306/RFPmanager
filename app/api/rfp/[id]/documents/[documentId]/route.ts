import { NextResponse } from "next/server";
import { getDocumentByRfp } from "@/lib/documents";
import { getErrorMessage } from "@/lib/errors";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; documentId: string }> },
) {
  try {
    const { id, documentId } = await params;
    const document = await getDocumentByRfp(id, documentId);

    if (!document) {
      return NextResponse.json({ error: "Document not found for this RFP." }, { status: 404 });
    }

    return NextResponse.json({ document: { id: document.id, markdown: document.markdown } });
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error, "Could not load document content.") }, { status: 500 });
  }
}
