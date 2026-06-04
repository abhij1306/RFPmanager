import { NextResponse } from "next/server";
import { chatgptAuthErrorResponse, validateChatgptApiKey } from "@/lib/chatgpt-auth";
import { toSourceFileSummaries } from "@/lib/chatgpt-source-files";
import { createRfpFileDownloadUrl, listFilesByRfp } from "@/lib/rfp-files";
import { getRfp } from "@/lib/rfps";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const validation = validateChatgptApiKey(request);

  if (!validation.ok) {
    return chatgptAuthErrorResponse(validation);
  }

  const { id } = await params;
  const rfp = await getRfp(id);

  if (!rfp) {
    return NextResponse.json({ error: "RFP not found." }, { status: 404 });
  }

  const sourceFiles = await toSourceFileSummaries(await listFilesByRfp(id), createRfpFileDownloadUrl);

  return NextResponse.json({ source_files: sourceFiles });
}
