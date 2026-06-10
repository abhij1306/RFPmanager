import { NextResponse } from "next/server";
import { toDocumentSummary } from "@/lib/chatgpt-documents";
import { normalizeOpenAiFileRefs } from "@/lib/chatgpt-files";
import { chatgptAuthErrorResponse, validateChatgptApiKey } from "@/lib/chatgpt-auth";
import { uploadRemoteSourceDocuments } from "@/lib/rfp-source-documents-server";
import { getRfp } from "@/lib/rfps";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const validation = validateChatgptApiKey(request);

  if (!validation.ok) {
    return chatgptAuthErrorResponse(validation);
  }

  try {
    const { id } = await params;
    const rfp = await getRfp(id);

    if (!rfp) {
      return NextResponse.json({ error: "RFP not found." }, { status: 404 });
    }

    const payload = await request.json();
    const refs = normalizeOpenAiFileRefs(payload);
    const savedDocuments = await uploadRemoteSourceDocuments({ refs, rfpId: id });
    const saved = savedDocuments.map(({ document, sourceFile }) => ({
      document: toDocumentSummary(document),
      source_file: sourceFile,
    }));

    return NextResponse.json({ saved }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not convert and save documents." },
      { status: 400 },
    );
  }
}
