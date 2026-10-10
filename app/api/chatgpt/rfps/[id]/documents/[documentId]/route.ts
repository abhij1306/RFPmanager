import { NextResponse } from "next/server";
import { chatgptAuthErrorResponse, validateChatgptApiKey } from "@/lib/chatgpt-auth";
import { getDocumentExcerptForChatgpt } from "@/lib/chatgpt-documents";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; documentId: string }> },
) {
  const validation = validateChatgptApiKey(request);

  if (!validation.ok) {
    return chatgptAuthErrorResponse(validation);
  }

  const { id, documentId } = await params;
  const searchParams = new URL(request.url).searchParams;
  const offset = Number(searchParams.get("offset") ?? "0");
  const limit = Number(searchParams.get("limit") ?? undefined);
  const result = await getDocumentExcerptForChatgpt(id, documentId, { offset, limit });

  if (result.status === "rfp_not_found") {
    return NextResponse.json({ error: "RFP not found." }, { status: 404 });
  }

  if (result.status === "document_not_found") {
    return NextResponse.json({ error: "Document not found for this RFP." }, { status: 404 });
  }

  return NextResponse.json({ document: result.document });
}
