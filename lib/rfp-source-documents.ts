import { convertFile } from "@/lib/document-conversion";
import { createDocument } from "@/lib/documents";
import { getErrorMessage, PartialUploadError } from "@/lib/errors";
import { uploadRfpFile } from "@/lib/rfp-files";
import type { RfpDocument, RfpFile } from "@/lib/types";

export type UploadedSourceDocument = {
  document: RfpDocument;
  sourceFile: RfpFile;
};

function fileTitle(file: File): string {
  return file.name.replace(/\.[^.]+$/, "") || file.name;
}

export async function uploadSourceDocument({
  file,
  rfpId,
  status = "Converted",
}: {
  file: File;
  rfpId: string;
  status?: string;
}): Promise<UploadedSourceDocument> {
  const result = await convertFile(file);
  const title = fileTitle(file);
  const sourceFile = await uploadRfpFile({
    body: file,
    kind: "source",
    mimeType: file.type || null,
    originalFilename: file.name,
    rfpId,
    status,
    title,
  });
  const document = await createDocument({
    rfp_id: rfpId,
    source_file_id: sourceFile.id,
    title,
    source_filename: file.name,
    source_type: result.sourceType,
    markdown: result.markdown,
  });

  return { document, sourceFile };
}

export async function uploadSourceDocuments({
  files,
  onProgress,
  rfpId,
  status = "Converted",
}: {
  files: File[];
  onProgress?: (completed: number, total: number, file: File) => void;
  rfpId: string;
  status?: string;
}): Promise<UploadedSourceDocument[]> {
  const saved: UploadedSourceDocument[] = [];

  for (const file of files) {
    try {
      saved.push(await uploadSourceDocument({ file, rfpId, status }));
    } catch (error) {
      const reason = getErrorMessage(error, "The upload failed.");
      throw new PartialUploadError(
        `Saved ${saved.length}/${files.length} source documents before ${file.name} failed: ${reason}`,
        saved,
        error,
      );
    }
    onProgress?.(saved.length, files.length, file);
  }

  return saved;
}
