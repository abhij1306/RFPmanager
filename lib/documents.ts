import { createTableHelpers, listCountsByRfp, type RfpCount } from "@/lib/table-helpers";
import { getSupabase } from "@/lib/supabase";
import type { RfpDocument, RfpDocumentInput } from "@/lib/types";

const selectFields = "id, rfp_id, source_file_id, title, source_filename, source_type, markdown, created_at";
const helpers = createTableHelpers<RfpDocument, RfpDocumentInput>("rfp_documents", selectFields);

export const listDocuments = helpers.list;

export const listDocumentsByRfp = helpers.listByRfp;

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
    throw error;
  }

  return data as RfpDocument | null;
}

export function listDocumentCountsByRfp(): Promise<RfpCount[]> {
  return listCountsByRfp("list_document_counts_by_rfp");
}
