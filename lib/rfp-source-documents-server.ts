import { getAllowedFileSourceType } from "@/lib/document-conversion-core";
import { convertBufferToMarkdown } from "@/lib/document-conversion-server";
import { createDocument } from "@/lib/documents";
import { getErrorMessage, PartialUploadError } from "@/lib/errors";
import { deleteRfpFile, uploadRfpFile } from "@/lib/rfp-files";
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

const REMOTE_UPLOAD_CONCURRENCY = 3;

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
  // Reject unsupported types before anything is stored.
  getAllowedFileSourceType(ref.name);
  const title = titleFromFilename(ref.name);

  // Storing the original and converting it are independent: overlap them, and remove the stored original
  // again if conversion or the Markdown insert fails so no source file is left without its document.
  const [conversion, upload] = await Promise.allSettled([
    convertBufferToMarkdown({ buffer, filename: ref.name }),
    uploadRfpFile({
      body: buffer,
      createdBy,
      kind: "source",
      mimeType: ref.mimeType,
      originalFilename: ref.name,
      rfpId,
      status,
      title,
    }),
  ]);

  if (conversion.status === "rejected") {
    if (upload.status === "fulfilled") await deleteRfpFile(upload.value).catch(() => undefined);
    throw conversion.reason;
  }

  if (upload.status === "rejected") throw upload.reason;

  const sourceFile = upload.value;
  let document: RfpDocument;
  try {
    document = await createDocument({
      rfp_id: rfpId,
      source_file_id: sourceFile.id,
      title,
      source_filename: ref.name,
      source_type: conversion.value.sourceType,
      markdown: conversion.value.markdown,
    });
  } catch (error) {
    await deleteRfpFile(sourceFile).catch(() => undefined);
    throw error;
  }

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
  // Downloads and storage uploads are network-bound, so a few refs run at once. Results keep input order.
  const results: Array<UploadedRemoteSourceDocument | undefined> = new Array(refs.length);
  let nextIndex = 0;
  let completed = 0;
  let failure: { ref: RemoteSourceDocumentRef; error: unknown } | null = null;

  async function worker() {
    while (!failure && nextIndex < refs.length) {
      const index = nextIndex++;
      const ref = refs[index];
      try {
        results[index] = await uploadRemoteSourceDocument({ ref, rfpId, status });
        completed += 1;
        onProgress?.(completed, refs.length, ref);
      } catch (error) {
        failure ??= { ref, error };
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(REMOTE_UPLOAD_CONCURRENCY, refs.length) }, worker));

  const saved = results.filter((item): item is UploadedRemoteSourceDocument => item !== undefined);

  // Assigned inside the workers; TypeScript can't see that through the closure.
  const failed = failure as { ref: RemoteSourceDocumentRef; error: unknown } | null;
  if (failed) {
    const { ref, error } = failed;
    const reason = getErrorMessage(error, "The upload failed.");
    throw new PartialUploadError(
      `Saved ${saved.length}/${refs.length} source documents before ${ref.name} failed: ${reason}`,
      saved,
      error,
    );
  }

  return saved;
}
