import { NextResponse } from "next/server";
import { chatgptAuthErrorResponse, validateChatgptApiKey } from "@/lib/chatgpt-auth";
import { createDocumentExcerpt } from "@/lib/chatgpt-documents";
import { getDocumentByRfp } from "@/lib/documents";
import { getRfp } from "@/lib/rfps";

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
  const rfp = await getRfp(id);

  if (!rfp) {
    return NextResponse.json({ error: "RFP not found." }, { status: 404 });
  }

  const document = await getDocumentByRfp(id, documentId);

  if (!document) {
    return NextResponse.json({ error: "Document not found for this RFP." }, { status: 404 });
  }

  const searchParams = new URL(request.url).searchParams;
  const offset = Number(searchParams.get("offset") ?? "0");
  const limit = Number(searchParams.get("limit") ?? undefined);

  return NextResponse.json({
    document: createDocumentExcerpt(document, { offset, limit }),
  });
}
