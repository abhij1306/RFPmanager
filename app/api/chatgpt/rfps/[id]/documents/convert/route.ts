import { NextResponse } from "next/server";
import { normalizeOpenAiFileRefs } from "@/lib/chatgpt-files";
import { chatgptAuthErrorResponse, validateChatgptApiKey } from "@/lib/chatgpt-auth";
import { convertBufferToMarkdown } from "@/lib/document-conversion-server";
import { createDocument } from "@/lib/documents";
import { uploadRfpFile } from "@/lib/rfp-files";
import { getRfp } from "@/lib/rfps";

export const dynamic = "force-dynamic";

function titleFromFilename(filename: string): string {
  return filename.replace(/\.[^.]+$/, "") || filename;
}

async function downloadOpenAiFile(downloadLink: string): Promise<ArrayBuffer> {
  const response = await fetch(downloadLink);

  if (!response.ok) {
    throw new Error(`Could not download OpenAI file: ${response.status} ${response.statusText}`.trim());
  }

  return response.arrayBuffer();
}

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
    const saved = [];

    for (const ref of refs) {
      const buffer = await downloadOpenAiFile(ref.downloadLink);
      const result = await convertBufferToMarkdown({ buffer, filename: ref.name });
      const sourceFile = await uploadRfpFile({
        body: buffer,
        createdBy: "ChatGPT",
        kind: "source",
        mimeType: ref.mimeType,
        originalFilename: ref.name,
        rfpId: id,
        status: "Converted",
        title: titleFromFilename(ref.name),
      });
      const document = await createDocument({
        rfp_id: id,
        source_file_id: sourceFile.id,
        title: titleFromFilename(ref.name),
        source_filename: ref.name,
        source_type: result.sourceType,
        markdown: result.markdown,
      });
      saved.push({ document, source_file: sourceFile });
    }

    return NextResponse.json({ saved }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not convert and save documents." },
      { status: 400 },
    );
  }
}
