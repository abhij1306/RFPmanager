import { NextResponse } from "next/server";
import { getAllowedFileSourceType, normalizeOpenAiFileRefs } from "@/lib/chatgpt-files";
import { chatgptAuthErrorResponse, validateChatgptApiKey } from "@/lib/chatgpt-auth";
import { createRfpFileDownloadUrl, listFilesByRfp, uploadRfpFile } from "@/lib/rfp-files";
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

  const files = await listFilesByRfp(id);
  const responses = await Promise.all(
    files
      .filter((file) => file.kind === "response")
      .map(async (file) => ({
        ...file,
        download_url: await createRfpFileDownloadUrl(file),
      })),
  );

  return NextResponse.json({ responses });
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

    const refs = normalizeOpenAiFileRefs(await request.json());
    const responses = [];

    for (const ref of refs) {
      getAllowedFileSourceType(ref.name);
      const buffer = await downloadOpenAiFile(ref.downloadLink);
      const responseFile = await uploadRfpFile({
        body: buffer,
        createdBy: "ChatGPT",
        kind: "response",
        mimeType: ref.mimeType,
        originalFilename: ref.name,
        rfpId: id,
        status: "Draft",
        title: titleFromFilename(ref.name),
      });
      responses.push(responseFile);
    }

    return NextResponse.json({ responses }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not save response files." },
      { status: 400 },
    );
  }
}
