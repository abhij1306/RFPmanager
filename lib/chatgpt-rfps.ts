import { listRfpPage, listRfps } from "@/lib/rfps";
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

export function resolveRfpListWindow(options: RfpListOptions = {}): { offset: number; limit: number } {
  const offset = clampNonNegativeInteger(options.offset, 0);
  const requestedLimit = clampNonNegativeInteger(options.limit, DEFAULT_RFP_LIST_LIMIT);
  const limit = Math.min(requestedLimit || DEFAULT_RFP_LIST_LIMIT, MAX_RFP_LIST_LIMIT);
  return { offset, limit };
}

function toPaginatedRfps(page: Rfp[], total: number, offset: number, limit: number): PaginatedRfps {
  const nextOffset = offset + page.length;
  const hasMore = nextOffset < total;

  return {
    rfps: page,
    total,
    offset,
    limit,
    has_more: hasMore,
    next_offset: hasMore ? nextOffset : null,
  };
}

/**
 * Search + paginate in the database (one round trip, only the requested page is transferred).
 * Falls back to the in-memory filter when the DB path can't answer exactly: a `*` in the term, an older
 * schema, or a multi-word term with no single-column match (the in-memory search also matches across
 * fields, e.g. "Active TBD").
 */
export async function listRfpsForChatgpt(search: string | null | undefined, options: RfpListOptions = {}): Promise<PaginatedRfps> {
  const { offset, limit } = resolveRfpListWindow(options);
  const page = await listRfpPage({ search, offset, limit });
  const crossFieldPossible = /\s/.test(normalizeSearch(search ?? ""));

  if (page && !(page.total === 0 && crossFieldPossible)) {
    return toPaginatedRfps(page.rfps, page.total, offset, limit);
  }

  return paginateRfpsForChatgpt(filterRfpsForChatgpt(await listRfps(), search), { offset, limit });
}

export function paginateRfpsForChatgpt(rfps: Rfp[], options: RfpListOptions = {}): PaginatedRfps {
  const { offset, limit } = resolveRfpListWindow(options);
  return toPaginatedRfps(rfps.slice(offset, offset + limit), rfps.length, offset, limit);
}
