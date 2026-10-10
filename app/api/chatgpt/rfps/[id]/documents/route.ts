import { NextResponse } from "next/server";
import { chatgptAuthErrorResponse, validateChatgptApiKey } from "@/lib/chatgpt-auth";
import { listDocumentSummariesForChatgpt } from "@/lib/chatgpt-documents";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const validation = validateChatgptApiKey(request);

  if (!validation.ok) {
    return chatgptAuthErrorResponse(validation);
  }

  const { id } = await params;
  const searchParams = new URL(request.url).searchParams;
  const offset = Number(searchParams.get("offset") ?? "0");
  const limit = Number(searchParams.get("limit") ?? undefined);
  const page = await listDocumentSummariesForChatgpt(id, { offset, limit });

  if (!page) {
    return NextResponse.json({ error: "RFP not found." }, { status: 404 });
  }

  return NextResponse.json(page);
}
