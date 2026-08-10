import { createTableHelpers, listCountsByRfp, type RfpCount } from "@/lib/table-helpers";
import { toError } from "@/lib/errors";
import { getSupabase } from "@/lib/supabase";
import type { RfpDocument, RfpDocumentInput } from "@/lib/types";

const selectFields = "id, rfp_id, source_file_id, title, source_filename, source_type, markdown, created_at";
const metadataSelectFields = "id, rfp_id, source_file_id, title, source_filename, source_type, created_at";
const helpers = createTableHelpers<RfpDocument, RfpDocumentInput>("rfp_documents", selectFields);
const metadataHelpers = createTableHelpers<RfpDocument, RfpDocumentInput>("rfp_documents", metadataSelectFields);

export type RfpDocumentPage = {
  documents: RfpDocument[];
  totalCount: number;
};

export const listDocuments = helpers.list;

export const listDocumentsByRfp = helpers.listByRfp;

/** Load document rows without the potentially large Markdown body. */
export async function listDocumentMetadataByRfp(rfpId: string): Promise<RfpDocument[]> {
  const rows = await metadataHelpers.listByRfp(rfpId);
  return rows.map((row) => ({ ...row, markdown: "" }));
}

export async function listDocumentMetadataPage({
  limit = 25,
  offset = 0,
  rfpId,
}: {
  limit?: number;
  offset?: number;
  rfpId?: string;
} = {}): Promise<RfpDocumentPage> {
  const supabase = getSupabase();
  let query = supabase
    .from("rfp_documents")
    .select(metadataSelectFields, { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (rfpId) query = query.eq("rfp_id", rfpId);

  const { count, data, error } = await query;
  if (error) throw toError(error, "Could not load document metadata.");

  return {
    documents: ((data ?? []) as RfpDocument[]).map((row) => ({ ...row, markdown: "" })),
    totalCount: count ?? 0,
  };
}

export const createDocument = helpers.create;

export const deleteDocument = helpers.remove;

export async function getDocumentByRfp(rfpId: string, documentId: string): Promise<RfpDocument | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("rfp_documents")
    .select(selectFields)
    .eq("rfp_id", rfpId)
    .eq("id", documentId)
    .maybeSingle();

  if (error) {
    throw toError(error, "Could not load document content.");
  }

  return data as RfpDocument | null;
}

export function listDocumentCountsByRfp(): Promise<RfpCount[]> {
  return listCountsByRfp("list_document_counts_by_rfp");
}
