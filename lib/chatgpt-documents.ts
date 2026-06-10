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
  const offset = clampNonNegativeInteger(options.offset, 0);
  const requestedLimit = clampNonNegativeInteger(options.limit, DEFAULT_DOCUMENT_LIST_LIMIT);
  const limit = Math.min(requestedLimit || DEFAULT_DOCUMENT_LIST_LIMIT, MAX_DOCUMENT_LIST_LIMIT);
  const page = documents.slice(offset, offset + limit).map(toDocumentSummary);
  const nextOffset = offset + page.length;
  const hasMore = nextOffset < documents.length;

  return {
    documents: page,
    total: documents.length,
    offset,
    limit,
    has_more: hasMore,
    next_offset: hasMore ? nextOffset : null,
  };
}

export function createDocumentExcerpt(
  document: RfpDocument,
  options: DocumentExcerptOptions = {},
): RfpDocumentExcerpt {
  const offset = clampNonNegativeInteger(options.offset, 0);
  const requestedLimit = clampNonNegativeInteger(options.limit, DEFAULT_MARKDOWN_EXCERPT_LENGTH);
  const limit = Math.min(requestedLimit || DEFAULT_MARKDOWN_EXCERPT_LENGTH, MAX_MARKDOWN_EXCERPT_LENGTH);
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
