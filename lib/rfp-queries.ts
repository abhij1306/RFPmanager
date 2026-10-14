import { toError } from "@/lib/errors";
import { getSupabase } from "@/lib/supabase";
import type { Rfp } from "@/lib/types";

export type RfpListItem = Pick<Rfp, "id" | "client_name" | "tender_code" | "closing_date" | "closing_date_text" | "created_at"> & {
  document_count: number;
};

type RfpListRow = Omit<RfpListItem, "document_count"> & { rfp_documents: Array<{ count: number }> | null };

/** One round trip: list fields plus an embedded document count per RFP. */
export async function listRfpIndex(): Promise<RfpListItem[]> {
  const { data, error } = await getSupabase()
    .from("rfps")
    .select("id, client_name, tender_code, closing_date, closing_date_text, created_at, rfp_documents(count)")
    .order("created_at", { ascending: false })
    .overrideTypes<RfpListRow[], { merge: false }>();

  if (error) throw toError(error, "Could not load RFPs.");

  return (data ?? []).map(({ rfp_documents: documents, ...rfp }) => ({
    ...rfp,
    document_count: documents?.[0]?.count ?? 0,
  }));
}

export type RfpDigestItem = Pick<
  Rfp,
  "id" | "client_name" | "tender_code" | "status" | "pipeline_stage" | "closing_date" | "closing_date_text" | "summary_generated_at"
> & {
  document_count: number;
};

type RfpDigestRow = Omit<RfpDigestItem, "document_count"> & { rfp_documents: Array<{ count: number }> | null };

/** One round trip for the Telegram bot's tender overview: status fields plus document count, no long text columns. */
export async function listRfpDigest(): Promise<RfpDigestItem[]> {
  const { data, error } = await getSupabase()
    .from("rfps")
    .select("id, client_name, tender_code, status, pipeline_stage, closing_date, closing_date_text, summary_generated_at, rfp_documents(count)")
    .order("closing_date", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false })
    .overrideTypes<RfpDigestRow[], { merge: false }>();

  if (error) throw toError(error, "Could not load RFPs.");

  return (data ?? []).map(({ rfp_documents: documents, ...rfp }) => ({
    ...rfp,
    document_count: documents?.[0]?.count ?? 0,
  }));
}

export type RfpDuplicateCandidate = Pick<
  Rfp,
  "id" | "client_name" | "tender_code" | "tender_link" | "closing_date" | "closing_date_text" | "description" | "contact_person" | "contact_phone" | "contact_email" | "document_links"
>;

/** Only the fields the import duplicate check compares, for RFPs that have a tender link. */
export async function listDuplicateCandidates(): Promise<RfpDuplicateCandidate[]> {
  const { data, error } = await getSupabase()
    .from("rfps")
    .select("id, client_name, tender_code, tender_link, closing_date, closing_date_text, description, contact_person, contact_phone, contact_email, document_links")
    .not("tender_link", "is", null)
    .overrideTypes<RfpDuplicateCandidate[], { merge: false }>();

  if (error) throw toError(error, "Could not check for an existing RFP.");
  return (data ?? []).map((rfp) => ({ ...rfp, document_links: Array.isArray(rfp.document_links) ? rfp.document_links : [] }));
}

export type RfpOption = Pick<Rfp, "id" | "client_name">;

/** Just enough to fill an RFP picker. */
export async function listRfpOptions(): Promise<RfpOption[]> {
  const { data, error } = await getSupabase()
    .from("rfps")
    .select("id, client_name")
    .order("created_at", { ascending: false })
    .overrideTypes<RfpOption[], { merge: false }>();

  if (error) throw toError(error, "Could not load RFPs.");
  return data ?? [];
}
