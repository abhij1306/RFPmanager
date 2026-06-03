import { createTableHelpers, listCountsByRfp, type RfpCount } from "@/lib/table-helpers";
import type { RfpDocument, RfpDocumentInput } from "@/lib/types";

const selectFields = "id, rfp_id, title, source_filename, source_type, markdown, created_at";
const helpers = createTableHelpers<RfpDocument, RfpDocumentInput>("rfp_documents", selectFields);

export const listDocuments = helpers.list;

export const listDocumentsByRfp = helpers.listByRfp;

export const createDocument = helpers.create;

export const deleteDocument = helpers.remove;

export function listDocumentCountsByRfp(): Promise<RfpCount[]> {
  return listCountsByRfp("list_document_counts_by_rfp");
}
