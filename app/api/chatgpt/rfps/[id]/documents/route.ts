import { NextResponse } from "next/server";
import { chatgptAuthErrorResponse, validateChatgptApiKey } from "@/lib/chatgpt-auth";
import { listDocumentsByRfp } from "@/lib/documents";
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

  const [documents, files] = await Promise.all([listDocumentsByRfp(id), listFilesByRfp(id)]);
  const sourceFiles = await Promise.all(
    files
      .filter((file) => file.kind === "source")
      .map(async (file) => ({
        ...file,
        download_url: await createRfpFileDownloadUrl(file),
      })),
  );

  return NextResponse.json({ documents, source_files: sourceFiles });
}
