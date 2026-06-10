import type { Rfp } from "@/lib/types";

export const DEFAULT_RFP_LIST_LIMIT = 25;
export const MAX_RFP_LIST_LIMIT = 25;

export type RfpListOptions = {
  offset?: number;
  limit?: number;
};

export type PaginatedRfps = {
  rfps: Rfp[];
  total: number;
  offset: number;
  limit: number;
  has_more: boolean;
  next_offset: number | null;
};

function normalizeSearch(value: string): string {
  return value.trim().toLowerCase();
}

function clampNonNegativeInteger(value: number | undefined, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.max(0, Math.floor(value));
}

function searchableRfpText(rfp: Rfp): string {
  return [
    rfp.client_name,
    rfp.tender_code,
    rfp.description,
    rfp.notes,
    rfp.tender_link,
    rfp.pipeline_stage,
    rfp.status,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export function filterRfpsForChatgpt(rfps: Rfp[], search: string | null | undefined): Rfp[] {
  const normalizedSearch = normalizeSearch(search ?? "");

  if (!normalizedSearch) {
    return rfps;
  }

  return rfps.filter((rfp) => searchableRfpText(rfp).includes(normalizedSearch));
}

export function paginateRfpsForChatgpt(rfps: Rfp[], options: RfpListOptions = {}): PaginatedRfps {
  const offset = clampNonNegativeInteger(options.offset, 0);
  const requestedLimit = clampNonNegativeInteger(options.limit, DEFAULT_RFP_LIST_LIMIT);
  const limit = Math.min(requestedLimit || DEFAULT_RFP_LIST_LIMIT, MAX_RFP_LIST_LIMIT);
  const page = rfps.slice(offset, offset + limit);
  const nextOffset = offset + page.length;
  const hasMore = nextOffset < rfps.length;

  return {
    rfps: page,
    total: rfps.length,
    offset,
    limit,
    has_more: hasMore,
    next_offset: hasMore ? nextOffset : null,
  };
}
