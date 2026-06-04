import { getSupabase } from "@/lib/supabase";
import type { Rfp, RfpImportInput, RfpInput, TenderDocumentLink } from "@/lib/types";

const selectFields =
  "id, client_name, status, closing_date, tender_code, tender_link, gdrive_link, description, contact_person, contact_phone, contact_email, document_links, summary, summary_generated_at, response_draft_title, response_draft_content, response_draft_saved_at, notes, pipeline_stage, created_at";
const legacySelectFields = "id, client_name, status, closing_date, tender_code, tender_link, gdrive_link, notes, pipeline_stage, created_at";

function withRfpDefaults(rfp: Partial<Rfp>): Rfp {
  return {
    id: rfp.id ?? "",
    client_name: rfp.client_name ?? "",
    status: rfp.status ?? "TBD",
    closing_date: rfp.closing_date ?? null,
    tender_code: rfp.tender_code ?? null,
    tender_link: rfp.tender_link ?? null,
    gdrive_link: rfp.gdrive_link ?? null,
    description: rfp.description ?? null,
    contact_person: rfp.contact_person ?? null,
    contact_phone: rfp.contact_phone ?? null,
    contact_email: rfp.contact_email ?? null,
    document_links: normalizeDocumentLinks(rfp.document_links),
    summary: rfp.summary ?? null,
    summary_generated_at: rfp.summary_generated_at ?? null,
    response_draft_title: rfp.response_draft_title ?? null,
    response_draft_content: rfp.response_draft_content ?? null,
    response_draft_saved_at: rfp.response_draft_saved_at ?? null,
    notes: rfp.notes ?? null,
    pipeline_stage: rfp.pipeline_stage ?? "Prospects",
    created_at: rfp.created_at ?? new Date(0).toISOString(),
  };
}

function isDocumentLink(value: unknown): value is TenderDocumentLink {
  if (!value || typeof value !== "object") {
    return false;
  }

  const link = value as Record<string, unknown>;
  return typeof link.name === "string" && typeof link.url === "string" && link.url.length > 0;
}

function normalizeDocumentLinks(value: unknown): TenderDocumentLink[] {
  return Array.isArray(value) ? value.filter(isDocumentLink).map((link) => ({ name: link.name, url: link.url })) : [];
}

function parseClosingDate(value?: string | null): string | null {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }

  const closesMatch = trimmed.match(/(?:closes\s+)?(?:[A-Za-z]{3,9},?\s+)?(\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4})/i);
  const parseable = closesMatch?.[1] ?? trimmed;
  const auDateMatch = parseable.match(/^(\d{1,2})\s+([A-Za-z]{3,9})\s+(\d{4})$/);

  if (auDateMatch) {
    const [, day, monthName, year] = auDateMatch;
    const month = [
      "jan",
      "feb",
      "mar",
      "apr",
      "may",
      "jun",
      "jul",
      "aug",
      "sep",
      "oct",
      "nov",
      "dec",
    ].indexOf(monthName.slice(0, 3).toLowerCase());

    if (month > -1) {
      return `${year}-${String(month + 1).padStart(2, "0")}-${day.padStart(2, "0")}`;
    }
  }

  const parsed = new Date(parseable);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toISOString().slice(0, 10);
}

export function normalizeImportedRfp(input: RfpImportInput): RfpInput {
  return {
    client_name: input.client_name.trim(),
    status: input.status ?? "TBD",
    closing_date: input.closing_date ?? parseClosingDate(input.closing_date_text),
    tender_code: input.tender_code ?? null,
    tender_link: input.tender_link ?? null,
    gdrive_link: input.gdrive_link ?? null,
    description: input.description ?? null,
    contact_person: input.contact_person ?? null,
    contact_phone: input.contact_phone ?? null,
    contact_email: input.contact_email ?? null,
    document_links: normalizeDocumentLinks(input.document_links),
    summary: input.summary ?? null,
    summary_generated_at: input.summary_generated_at ?? null,
    response_draft_title: input.response_draft_title ?? null,
    response_draft_content: input.response_draft_content ?? null,
    response_draft_saved_at: input.response_draft_saved_at ?? null,
    notes: input.notes ?? null,
    pipeline_stage: input.pipeline_stage ?? "Prospects",
  };
}

export async function listRfps(): Promise<Rfp[]> {
  const supabase = getSupabase();
  let data: Partial<Rfp>[] | null = null;
  let error = null;

  const primary = await supabase
    .from("rfps")
    .select(selectFields)
    .order("closing_date", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });
  data = primary.data;
  error = primary.error;

  if (error) {
    const fallback = await supabase
      .from("rfps")
      .select(legacySelectFields)
      .order("closing_date", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false });
    data = fallback.data;
    error = fallback.error;
  }

  if (error) {
    throw error;
  }

  return (data ?? []).map(withRfpDefaults);
}

export async function getRfp(id: string): Promise<Rfp | null> {
  const supabase = getSupabase();
  let data: Partial<Rfp> | null = null;
  let error = null;

  const primary = await supabase.from("rfps").select(selectFields).eq("id", id).maybeSingle();
  data = primary.data;
  error = primary.error;

  if (error) {
    const fallback = await supabase.from("rfps").select(legacySelectFields).eq("id", id).maybeSingle();
    data = fallback.data;
    error = fallback.error;
  }

  if (error) {
    throw error;
  }

  return data ? withRfpDefaults(data) : null;
}

export async function createRfp(input: RfpInput): Promise<Rfp> {
  const supabase = getSupabase();
  const { data, error } = await supabase.from("rfps").insert(input).select(selectFields).single();

  if (error) {
    throw error;
  }

  return data;
}

export async function updateRfp(id: string, input: Partial<RfpInput>): Promise<Rfp> {
  const supabase = getSupabase();
  const { data, error } = await supabase.from("rfps").update(input).eq("id", id).select(selectFields).single();

  if (error) {
    throw error;
  }

  return data;
}

export async function deleteRfp(id: string): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase.from("rfps").delete().eq("id", id);

  if (error) {
    throw error;
  }
}

export async function updateRfpSummary(id: string, summary: string): Promise<Rfp> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("rfps")
    .update({ summary, summary_generated_at: new Date().toISOString() })
    .eq("id", id)
    .select(selectFields)
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function updateRfpResponseDraft(id: string, title: string, content: string): Promise<Rfp> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("rfps")
    .update({
      response_draft_title: title,
      response_draft_content: content,
      response_draft_saved_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select(selectFields)
    .single();

  if (error) {
    throw error;
  }

  return data;
}
