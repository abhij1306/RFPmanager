import { convertBufferToMarkdown } from "@/lib/document-conversion-server";
import { createDocument } from "@/lib/documents";
import { uploadRfpFile } from "@/lib/rfp-files";
import type { RfpDocument, RfpFile } from "@/lib/types";

export type RemoteSourceDocumentRef = {
  name: string;
  mimeType: string | null;
  downloadLink: string;
};

export type UploadedRemoteSourceDocument = {
  document: RfpDocument;
  sourceFile: RfpFile;
};

function titleFromFilename(filename: string): string {
  return filename.replace(/\.[^.]+$/, "") || filename;
}

async function downloadRemoteSourceDocument(downloadLink: string): Promise<ArrayBuffer> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);

  let response: Response;
  try {
    response = await fetch(downloadLink, { signal: controller.signal });
  } catch (error) {
    clearTimeout(timeout);
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error(`Download timed out after 30 seconds: ${downloadLink}`);
    }
    throw error;
  }

  clearTimeout(timeout);

  if (!response.ok) {
    throw new Error(`Could not download OpenAI file: ${response.status} ${response.statusText}`.trim());
  }

  return response.arrayBuffer();
}

export async function uploadRemoteSourceDocument({
  createdBy = "ChatGPT",
  ref,
  rfpId,
  status = "Converted",
}: {
  createdBy?: string;
  ref: RemoteSourceDocumentRef;
  rfpId: string;
  status?: string;
}): Promise<UploadedRemoteSourceDocument> {
  const buffer = await downloadRemoteSourceDocument(ref.downloadLink);
  const result = await convertBufferToMarkdown({ buffer, filename: ref.name });
  const title = titleFromFilename(ref.name);
  const sourceFile = await uploadRfpFile({
    body: buffer,
    createdBy,
    kind: "source",
    mimeType: ref.mimeType,
    originalFilename: ref.name,
    rfpId,
    status,
    title,
  });
  const document = await createDocument({
    rfp_id: rfpId,
    source_file_id: sourceFile.id,
    title,
    source_filename: ref.name,
    source_type: result.sourceType,
    markdown: result.markdown,
  });

  return { document, sourceFile };
}

export async function uploadRemoteSourceDocuments({
  onProgress,
  refs,
  rfpId,
  status = "Converted",
}: {
  onProgress?: (completed: number, total: number, ref: RemoteSourceDocumentRef) => void;
  refs: RemoteSourceDocumentRef[];
  rfpId: string;
  status?: string;
}): Promise<UploadedRemoteSourceDocument[]> {
  const saved: UploadedRemoteSourceDocument[] = [];

  for (const ref of refs) {
    saved.push(await uploadRemoteSourceDocument({ ref, rfpId, status }));
    onProgress?.(saved.length, refs.length, ref);
  }

  return saved;
}
