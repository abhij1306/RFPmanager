import { callOptionalRpc, createTableHelpers, listCountsByRfp, type RfpCount } from "@/lib/table-helpers";
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

/** Document metadata plus what the RPCs compute server-side (length is in UTF-16 code units, like String#length). */
export type RfpDocumentSummaryRow = Omit<RfpDocument, "markdown"> & {
  markdown_length: number;
  /** First 500 code points; callers slice to 500 UTF-16 code units. */
  markdown_preview: string;
};

type RawDocumentSummaryRow = Omit<RfpDocumentSummaryRow, "markdown_length"> & {
  markdown_length: number | string;
  total_count: number | string;
};

/**
 * One page of document summaries computed in Postgres (list_rfp_document_summaries), so no Markdown bodies
 * cross the wire. Resolves to null when the RPC is not installed yet. `total` is null when the page is empty
 * (the window count has no row to ride on).
 */
export async function listDocumentSummaryRowsPage(
  rfpId: string,
  { limit, offset }: { limit: number; offset: number },
): Promise<{ rows: RfpDocumentSummaryRow[]; total: number | null } | null> {
  const rows = await callOptionalRpc<RawDocumentSummaryRow>(
    "list_rfp_document_summaries",
    { p_rfp_id: rfpId, p_limit: limit, p_offset: offset },
    "Could not list rfp_documents for this RFP.",
  );
  if (!rows) return null;

  return {
    rows: rows.map(({ total_count: _totalCount, ...row }) => ({ ...row, markdown_length: Number(row.markdown_length) })),
    total: rows.length > 0 ? Number(rows[0].total_count) : null,
  };
}

export async function countDocumentsByRfp(rfpId: string): Promise<number> {
  const supabase = getSupabase();
  const { count, error } = await supabase
    .from("rfp_documents")
    .select("id", { count: "exact", head: true })
    .eq("rfp_id", rfpId);

  if (error) throw toError(error, "Could not list rfp_documents for this RFP.");
  return count ?? 0;
}

/**
 * Fallback page loader: full rows (with Markdown) for just the requested page, plus an exact total,
 * in one round trip. Ordered like listDocumentsByRfp with id as a stable tiebreaker.
 */
export async function listDocumentsPageByRfp(
  rfpId: string,
  { limit, offset }: { limit: number; offset: number },
): Promise<{ documents: RfpDocument[]; total: number }> {
  const supabase = getSupabase();
  const { count, data, error } = await supabase
    .from("rfp_documents")
    .select(selectFields, { count: "exact" })
    .eq("rfp_id", rfpId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: true })
    .range(offset, offset + limit - 1);

  if (error) {
    // Offset past the end: PostgREST answers 416 instead of an empty page.
    if ((error as { code?: unknown }).code === "PGRST103") {
      return { documents: [], total: await countDocumentsByRfp(rfpId) };
    }
    throw toError(error, "Could not list rfp_documents for this RFP.");
  }

  return { documents: (data ?? []) as RfpDocument[], total: count ?? 0 };
}

export type RfpDocumentExcerptRow = RfpDocumentSummaryRow & {
  /** The requested slice, or the whole Markdown when is_full_markdown is true. */
  markdown: string;
  /** True when the document contains characters outside the BMP, where SQL and JS offsets differ. */
  is_full_markdown: boolean;
};

/**
 * Fetch only the requested slice of one document (get_rfp_document_excerpt). Offsets are UTF-16 code units.
 * Resolves to undefined when the RPC is not installed yet, null when the document is not found.
 */
export async function getDocumentExcerptRow(
  rfpId: string,
  documentId: string,
  { limit, offset }: { limit: number; offset: number },
): Promise<RfpDocumentExcerptRow | null | undefined> {
  const rows = await callOptionalRpc<RfpDocumentExcerptRow & { markdown_length: number | string }>(
    "get_rfp_document_excerpt",
    { p_rfp_id: rfpId, p_document_id: documentId, p_offset: offset, p_limit: limit },
    "Could not load document content.",
  );
  if (!rows) return undefined;

  const row = rows[0];
  return row ? { ...row, markdown_length: Number(row.markdown_length) } : null;
}

/** Only the fields the UI reader needs. */
export async function getDocumentMarkdownByRfp(
  rfpId: string,
  documentId: string,
): Promise<Pick<RfpDocument, "id" | "markdown"> | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("rfp_documents")
    .select("id, markdown")
    .eq("rfp_id", rfpId)
    .eq("id", documentId)
    .maybeSingle();

  if (error) {
    throw toError(error, "Could not load document content.");
  }

  return data as Pick<RfpDocument, "id" | "markdown"> | null;
}
