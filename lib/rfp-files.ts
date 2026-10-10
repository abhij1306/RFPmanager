import { callOptionalRpc, createTableHelpers, listCountsByRfp, type RfpCount } from "@/lib/table-helpers";
import { toError } from "@/lib/errors";
import { getSupabase } from "@/lib/supabase";
import type { RfpFile, RfpFileInput, RfpFileKind } from "@/lib/types";

export const RFP_FILES_BUCKET = "rfp-files";

const selectFields =
  "id, rfp_id, kind, title, original_filename, mime_type, storage_path, file_size_bytes, status, notes, created_by, created_at";
const helpers = createTableHelpers<RfpFile, RfpFileInput>("rfp_files", selectFields);

export const listFiles = helpers.list;
export const listFilesByRfp = helpers.listByRfp;
export const createFileRecord = helpers.create;

function sanitizePathPart(value: string): string {
  return value
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

function getExtension(filename: string): string {
  const extension = filename.split(".").pop();
  return extension && extension !== filename ? `.${sanitizePathPart(extension.toLowerCase())}` : "";
}

export function buildStoragePath(rfpId: string, kind: RfpFileKind, filename: string): string {
  const safeBase = sanitizePathPart(filename.replace(/\.[^.]+$/, "")) || "file";
  return `${rfpId}/${kind}/${crypto.randomUUID()}-${safeBase}${getExtension(filename)}`;
}

export async function uploadRfpFile({
  body,
  createdBy = "Team",
  kind,
  mimeType,
  notes = null,
  originalFilename,
  rfpId,
  status = "Saved",
  title,
}: {
  body: Blob | ArrayBuffer | Uint8Array;
  createdBy?: string;
  kind: RfpFileKind;
  mimeType?: string | null;
  notes?: string | null;
  originalFilename: string;
  rfpId: string;
  status?: string | null;
  title?: string;
}): Promise<RfpFile> {
  const supabase = getSupabase();
  const storagePath = buildStoragePath(rfpId, kind, originalFilename);
  const uploadBody = body instanceof ArrayBuffer ? new Uint8Array(body) : body;
  const fileSizeBytes =
    uploadBody instanceof Blob ? uploadBody.size : uploadBody instanceof Uint8Array ? uploadBody.byteLength : null;

  const { error: uploadError } = await supabase.storage.from(RFP_FILES_BUCKET).upload(storagePath, uploadBody, {
    contentType: mimeType ?? undefined,
    upsert: false,
  });

  if (uploadError) {
    throw toError(uploadError, "Could not upload the file.");
  }

  try {
    return await createFileRecord({
      rfp_id: rfpId,
      kind,
      title: title?.trim() || originalFilename,
      original_filename: originalFilename,
      mime_type: mimeType ?? null,
      storage_path: storagePath,
      file_size_bytes: fileSizeBytes,
      status,
      notes,
      created_by: createdBy,
    });
  } catch (error) {
    await supabase.storage.from(RFP_FILES_BUCKET).remove([storagePath]);
    throw error;
  }
}

export async function deleteRfpFile(file: RfpFile): Promise<void> {
  const supabase = getSupabase();
  const { error: storageError } = await supabase.storage.from(RFP_FILES_BUCKET).remove([file.storage_path]);

  if (storageError) {
    throw toError(storageError, "Could not delete the stored file.");
  }

  await helpers.remove(file.id);
}

export async function createRfpFileDownloadUrl(file: RfpFile): Promise<string> {
  const supabase = getSupabase();
  const { data, error } = await supabase.storage.from(RFP_FILES_BUCKET).createSignedUrl(file.storage_path, 60 * 10, {
    download: file.original_filename,
  });

  if (error) {
    throw toError(error, "Could not create a file download link.");
  }

  return data.signedUrl;
}

export function listFileCountsByRfp(): Promise<RfpCount[]> {
  return listCountsByRfp("list_file_counts_by_rfp");
}

export async function listSourceFileCountsByRfp(): Promise<RfpCount[]> {
  const rows = await callOptionalRpc<{ rfp_id: string; count: number | string }>(
    "list_source_file_counts_by_rfp",
    undefined,
    "Could not count source files.",
  );
  if (rows) return rows.map((row) => ({ rfp_id: row.rfp_id, count: Number(row.count) }));

  const supabase = getSupabase();
  const { data, error } = await supabase.from("rfp_files").select("rfp_id").eq("kind", "source");
  if (error) throw toError(error, "Could not count source files.");

  const counts = new Map<string, number>();
  for (const row of data ?? []) {
    counts.set(row.rfp_id, (counts.get(row.rfp_id) ?? 0) + 1);
  }
  return Array.from(counts, ([rfp_id, count]) => ({ rfp_id, count }));
}

/** Files of one kind for an RFP (uses the rfp_id, kind, created_at index). */
export async function listFilesByRfpAndKind(rfpId: string, kind: RfpFileKind): Promise<RfpFile[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("rfp_files")
    .select(selectFields)
    .eq("rfp_id", rfpId)
    .eq("kind", kind)
    .order("created_at", { ascending: false });

  if (error) {
    throw toError(error, "Could not list rfp_files for this RFP.");
  }

  return (data ?? []) as RfpFile[];
}

/**
 * Sign download URLs for many files with one storage call (createSignedUrls) instead of one call per file.
 * Returns a per-file resolver producing the same URL format as createRfpFileDownloadUrl; any file the batch
 * could not sign (or the whole batch failing) falls back to createRfpFileDownloadUrl for that file.
 */
export async function createRfpFileDownloadUrlBatch(files: RfpFile[]): Promise<(file: RfpFile) => Promise<string>> {
  const signed = new Map<string, string>();

  if (files.length > 1) {
    try {
      const supabase = getSupabase();
      const { data, error } = await supabase.storage.from(RFP_FILES_BUCKET).createSignedUrls(
        files.map((file) => file.storage_path),
        60 * 10,
      );

      if (!error) {
        for (const item of data ?? []) {
          if (item.path && item.signedUrl && !item.error) signed.set(item.path, item.signedUrl);
        }
      }
    } catch {
      // Fall back to per-file signing below.
    }
  }

  return async (file) => {
    const signedUrl = signed.get(file.storage_path);
    if (!signedUrl) return createRfpFileDownloadUrl(file);
    if (!file.original_filename) return signedUrl;
    // Mirrors storage-js: encodeURI(`${url}${signedURL}&${new URLSearchParams({ download })}`).
    return `${signedUrl}&${encodeURI(new URLSearchParams({ download: file.original_filename }).toString())}`;
  };
}
