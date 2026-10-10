import { NextResponse } from "next/server";
import { chatgptAuthErrorResponse, validateChatgptApiKey } from "@/lib/chatgpt-auth";
import { toSourceFileSummaries } from "@/lib/chatgpt-source-files";
import { createRfpFileDownloadUrlBatch, listFilesByRfpAndKind } from "@/lib/rfp-files";
import { rfpExists } from "@/lib/rfps";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const validation = validateChatgptApiKey(request);

  if (!validation.ok) {
    return chatgptAuthErrorResponse(validation);
  }

  const { id } = await params;
  const files = await listFilesByRfpAndKind(id, "source");

  if (files.length === 0 && !(await rfpExists(id))) {
    return NextResponse.json({ error: "RFP not found." }, { status: 404 });
  }

  const sourceFiles = await toSourceFileSummaries(files, await createRfpFileDownloadUrlBatch(files));

  return NextResponse.json({ source_files: sourceFiles });
}
