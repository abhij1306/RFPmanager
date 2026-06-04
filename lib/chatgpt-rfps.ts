import type { Rfp } from "@/lib/types";

function normalizeSearch(value: string): string {
  return value.trim().toLowerCase();
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
