import {
  countDocumentsByRfp,
  getDocumentByRfp,
  getDocumentExcerptRow,
  listDocumentSummaryRowsPage,
  listDocumentsPageByRfp,
  type RfpDocumentSummaryRow,
} from "@/lib/documents";
import { rfpExists } from "@/lib/rfps";
import type { RfpDocument } from "@/lib/types";

export const DEFAULT_MARKDOWN_PREVIEW_LENGTH = 500;
export const DEFAULT_DOCUMENT_LIST_LIMIT = 10;
export const MAX_DOCUMENT_LIST_LIMIT = 20;
export const DEFAULT_MARKDOWN_EXCERPT_LENGTH = 45000;
export const MAX_MARKDOWN_EXCERPT_LENGTH = 90000;

export type RfpDocumentSummary = Omit<RfpDocument, "markdown"> & {
  markdown_length: number;
  markdown_preview: string;
};

export type DocumentExcerptOptions = {
  offset?: number;
  limit?: number;
};

export type RfpDocumentExcerpt = RfpDocumentSummary & {
  markdown: string;
  offset: number;
  limit: number;
  next_offset: number | null;
  has_more: boolean;
};

export type PaginatedDocumentSummaries = {
  documents: RfpDocumentSummary[];
  total: number;
  offset: number;
  limit: number;
  has_more: boolean;
  next_offset: number | null;
};

function clampNonNegativeInteger(value: number | undefined, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.max(0, Math.floor(value));
}

export function toDocumentSummary(document: RfpDocument): RfpDocumentSummary {
  const { markdown, ...metadata } = document;

  return {
    ...metadata,
    markdown_length: markdown.length,
    markdown_preview: markdown.slice(0, DEFAULT_MARKDOWN_PREVIEW_LENGTH),
  };
}

export function paginateDocumentSummaries(
  documents: RfpDocument[],
  options: DocumentExcerptOptions = {},
): PaginatedDocumentSummaries {
  const { offset, limit } = resolveDocumentListWindow(options);
  return toPaginatedSummaries(documents.slice(offset, offset + limit).map(toDocumentSummary), documents.length, offset, limit);
}

export function resolveDocumentListWindow(options: DocumentExcerptOptions = {}): { offset: number; limit: number } {
  const offset = clampNonNegativeInteger(options.offset, 0);
  const requestedLimit = clampNonNegativeInteger(options.limit, DEFAULT_DOCUMENT_LIST_LIMIT);
  const limit = Math.min(requestedLimit || DEFAULT_DOCUMENT_LIST_LIMIT, MAX_DOCUMENT_LIST_LIMIT);
  return { offset, limit };
}

export function resolveDocumentExcerptWindow(options: DocumentExcerptOptions = {}): { offset: number; limit: number } {
  const offset = clampNonNegativeInteger(options.offset, 0);
  const requestedLimit = clampNonNegativeInteger(options.limit, DEFAULT_MARKDOWN_EXCERPT_LENGTH);
  const limit = Math.min(requestedLimit || DEFAULT_MARKDOWN_EXCERPT_LENGTH, MAX_MARKDOWN_EXCERPT_LENGTH);
  return { offset, limit };
}

function toPaginatedSummaries(
  page: RfpDocumentSummary[],
  total: number,
  offset: number,
  limit: number,
): PaginatedDocumentSummaries {
  const nextOffset = offset + page.length;
  const hasMore = nextOffset < total;

  return {
    documents: page,
    total,
    offset,
    limit,
    has_more: hasMore,
    next_offset: hasMore ? nextOffset : null,
  };
}

/** Same key order and values as toDocumentSummary, built from server-computed fields. */
export function summaryFromRow(row: RfpDocumentSummaryRow): RfpDocumentSummary {
  return {
    id: row.id,
    rfp_id: row.rfp_id,
    source_file_id: row.source_file_id,
    title: row.title,
    source_filename: row.source_filename,
    source_type: row.source_type,
    created_at: row.created_at,
    markdown_length: row.markdown_length,
    markdown_preview: row.markdown_preview.slice(0, DEFAULT_MARKDOWN_PREVIEW_LENGTH),
  };
}

/**
 * Page of document summaries for an RFP, or null when the RFP does not exist.
 * Uses the list_rfp_document_summaries RPC when installed (no Markdown bodies transferred), else loads only
 * the requested page. The existence check only runs when the page comes back empty.
 */
export async function listDocumentSummariesForChatgpt(
  rfpId: string,
  options: DocumentExcerptOptions = {},
): Promise<PaginatedDocumentSummaries | null> {
  const { offset, limit } = resolveDocumentListWindow(options);
  const rpcPage = await listDocumentSummaryRowsPage(rfpId, { offset, limit });

  if (rpcPage) {
    if (rpcPage.total !== null) {
      return toPaginatedSummaries(rpcPage.rows.map(summaryFromRow), rpcPage.total, offset, limit);
    }

    const [exists, total] = await Promise.all([rfpExists(rfpId), countDocumentsByRfp(rfpId)]);
    return exists ? toPaginatedSummaries([], total, offset, limit) : null;
  }

  const { documents, total } = await listDocumentsPageByRfp(rfpId, { offset, limit });
  if (documents.length === 0 && !(await rfpExists(rfpId))) return null;
  return toPaginatedSummaries(documents.map(toDocumentSummary), total, offset, limit);
}

export type DocumentExcerptLookup =
  | { status: "ok"; document: RfpDocumentExcerpt }
  | { status: "rfp_not_found" }
  | { status: "document_not_found" };

/**
 * Bounded excerpt of one document. Fetches only the requested slice via get_rfp_document_excerpt when
 * installed, else the single document row. The RFP existence check only runs when the document is missing.
 */
export async function getDocumentExcerptForChatgpt(
  rfpId: string,
  documentId: string,
  options: DocumentExcerptOptions = {},
): Promise<DocumentExcerptLookup> {
  const { offset, limit } = resolveDocumentExcerptWindow(options);
  const row = await getDocumentExcerptRow(rfpId, documentId, { offset, limit });
  let excerpt: RfpDocumentExcerpt | null = null;

  if (row === undefined) {
    const document = await getDocumentByRfp(rfpId, documentId);
    excerpt = document ? createDocumentExcerpt(document, { offset, limit }) : null;
  } else if (row) {
    excerpt = row.is_full_markdown ? createDocumentExcerpt(documentFromRow(row), { offset, limit }) : excerptFromSlice(row, offset, limit);
  }

  if (excerpt) return { status: "ok", document: excerpt };
  return (await rfpExists(rfpId)) ? { status: "document_not_found" } : { status: "rfp_not_found" };
}

function documentFromRow(row: RfpDocumentSummaryRow & { markdown: string }): RfpDocument {
  return {
    id: row.id,
    rfp_id: row.rfp_id,
    source_file_id: row.source_file_id,
    title: row.title,
    source_filename: row.source_filename,
    source_type: row.source_type,
    markdown: row.markdown,
    created_at: row.created_at,
  };
}

function excerptFromSlice(
  row: RfpDocumentSummaryRow & { markdown: string },
  offset: number,
  limit: number,
): RfpDocumentExcerpt {
  const markdown = row.markdown;
  const nextOffset = offset + markdown.length;
  const hasMore = nextOffset < row.markdown_length;

  return {
    ...summaryFromRow(row),
    markdown,
    offset,
    limit,
    next_offset: hasMore ? nextOffset : null,
    has_more: hasMore,
  };
}

export function createDocumentExcerpt(
  document: RfpDocument,
  options: DocumentExcerptOptions = {},
): RfpDocumentExcerpt {
  const { offset, limit } = resolveDocumentExcerptWindow(options);
  const markdown = document.markdown.slice(offset, offset + limit);
  const nextOffset = offset + markdown.length;
  const hasMore = nextOffset < document.markdown.length;

  return {
    ...toDocumentSummary(document),
    markdown,
    offset,
    limit,
    next_offset: hasMore ? nextOffset : null,
    has_more: hasMore,
  };
}
