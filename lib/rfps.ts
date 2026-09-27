import { getSupabase } from "@/lib/supabase";
import { toError } from "@/lib/errors";
import { parseTenderDate } from "@/lib/date";
import type { Rfp, RfpCreateInput, RfpImportInput, RfpInput, RfpUpdateInput, TenderDocumentLink } from "@/lib/types";

const selectFields =
  "id, client_name, status, closing_date, closing_date_text, tender_code, tender_link, gdrive_link, description, contact_person, contact_phone, contact_email, document_links, summary, summary_generated_at, response_draft_title, response_draft_content, response_draft_saved_at, notes, pipeline_stage, created_at";
const preDeadlineSelectFields = selectFields.replace("closing_date_text, ", "");
const trackerSelectFields = "id, client_name, status, closing_date, closing_date_text, tender_code, tender_link, gdrive_link, document_links, pipeline_stage, created_at";
const preDeadlineTrackerSelectFields = trackerSelectFields.replace("closing_date_text, ", "");
const legacySelectFields = "id, client_name, status, closing_date, tender_code, tender_link, gdrive_link, notes, pipeline_stage, created_at";

function isMissingColumnError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;

  const { code } = error as { code?: unknown };
  return code === "42703" || code === "PGRST204";
}

function withRfpDefaults(rfp: Partial<Rfp>): Rfp {
  return {
    id: rfp.id ?? "",
    client_name: rfp.client_name ?? "",
    status: rfp.status ?? "TBD",
    closing_date: rfp.closing_date ?? null,
    closing_date_text: rfp.closing_date_text ?? null,
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
  if (typeof link.name !== "string" || typeof link.url !== "string") return false;
  try { return ["http:", "https:"].includes(new URL(link.url).protocol); } catch { return false; }
}

function normalizeDocumentLinks(value: unknown): TenderDocumentLink[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  return value.filter(isDocumentLink).map((link) => ({ name: link.name.trim(), url: link.url.trim() })).filter((link) => {
    const url = new URL(link.url);
    url.hash = "";
    const key = url.toString();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function normalizeImportedRfp(input: RfpImportInput): RfpInput {
  return {
    client_name: input.client_name.trim(),
    status: input.status ?? "TBD",
    closing_date: parseTenderDate(input.closing_date) ?? parseTenderDate(input.closing_date_text),
    closing_date_text: input.closing_date_text ?? null,
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

export function normalizeRfpUpdate(input: RfpUpdateInput): Partial<RfpInput> {
  const { closing_date_text: closingDateText, ...fields } = input;
  const update = Object.fromEntries(
    Object.entries(fields).filter(([, value]) => value !== undefined),
  ) as Partial<RfpInput>;

  if (!("closing_date" in update) && closingDateText) {
    const parsedClosingDate = parseTenderDate(closingDateText);

    if (parsedClosingDate) {
      update.closing_date = parsedClosingDate;
    }
  }

  if (closingDateText !== undefined) update.closing_date_text = closingDateText;

  return update;
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

  if (isMissingColumnError(error)) {
    const previous = await supabase.from("rfps").select(preDeadlineSelectFields).order("closing_date", { ascending: true, nullsFirst: false }).order("created_at", { ascending: false });
    data = previous.data as unknown as Partial<Rfp>[] | null;
    error = previous.error;
  }

  if (isMissingColumnError(error)) {
    const fallback = await supabase
      .from("rfps")
      .select(legacySelectFields)
      .order("closing_date", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false });
    data = fallback.data;
    error = fallback.error;
  }

  if (error) {
    throw toError(error, "Could not list RFPs.");
  }

  return (data ?? []).map(withRfpDefaults);
}

/** Load only the fields needed by the tracker table. */
export async function listTrackerRfps(): Promise<Rfp[]> {
  const supabase = getSupabase();
  let data: Partial<Rfp>[] | null = null;
  let error = null;

  const primary = await supabase
    .from("rfps")
    .select(trackerSelectFields)
    .order("closing_date", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });
  data = primary.data;
  error = primary.error;

  if (isMissingColumnError(error)) {
    const previous = await supabase.from("rfps").select(preDeadlineTrackerSelectFields).order("closing_date", { ascending: true, nullsFirst: false }).order("created_at", { ascending: false });
    data = previous.data as unknown as Partial<Rfp>[] | null;
    error = previous.error;
  }

  if (isMissingColumnError(error)) {
    const fallback = await supabase
      .from("rfps")
      .select(legacySelectFields)
      .order("closing_date", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false });
    data = fallback.data;
    error = fallback.error;
  }

  if (error) throw toError(error, "Could not list tracker RFPs.");
  return (data ?? []).map(withRfpDefaults);
}

export async function getRfp(id: string): Promise<Rfp | null> {
  const supabase = getSupabase();
  let data: Partial<Rfp> | null = null;
  let error = null;

  const primary = await supabase.from("rfps").select(selectFields).eq("id", id).maybeSingle();
  data = primary.data;
  error = primary.error;

  if (isMissingColumnError(error)) {
    const previous = await supabase.from("rfps").select(preDeadlineSelectFields).eq("id", id).maybeSingle();
    data = previous.data as unknown as Partial<Rfp> | null;
    error = previous.error;
  }

  if (isMissingColumnError(error)) {
    const fallback = await supabase.from("rfps").select(legacySelectFields).eq("id", id).maybeSingle();
    data = fallback.data;
    error = fallback.error;
  }

  if (error) {
    throw toError(error, "Could not load the RFP.");
  }

  return data ? withRfpDefaults(data) : null;
}

export async function createRfp(input: RfpCreateInput): Promise<Rfp> {
  const supabase = getSupabase();
  const first = await supabase.from("rfps").insert(input).select(selectFields).single();
  let data: Partial<Rfp> | null = first.data;
  let error = first.error;

  if (isMissingColumnError(error)) {
    if (input.closing_date_text) throw new Error("Apply the closing_date_text schema update before saving an imported deadline.");
    const previousInput = { ...input };
    delete previousInput.closing_date_text;
    const previous = await supabase.from("rfps").insert(previousInput).select(preDeadlineSelectFields).single();
    data = previous.data as unknown as Partial<Rfp> | null;
    error = previous.error;
  }

  if (error) {
    throw toError(error, "Could not create the RFP.");
  }

  if (!data) throw new Error("Could not create the RFP.");
  return withRfpDefaults(data);
}

export async function updateRfp(id: string, input: Partial<RfpInput>): Promise<Rfp> {
  const supabase = getSupabase();
  const first = await supabase.from("rfps").update(input).eq("id", id).select(selectFields).single();
  let data: Partial<Rfp> | null = first.data;
  let error = first.error;

  if (isMissingColumnError(error)) {
    if (input.closing_date_text) throw new Error("Apply the closing_date_text schema update before saving an imported deadline.");
    const previousInput = { ...input };
    delete previousInput.closing_date_text;
    const previous = await supabase.from("rfps").update(previousInput).eq("id", id).select(preDeadlineSelectFields).single();
    data = previous.data as unknown as Partial<Rfp> | null;
    error = previous.error;
  }

  if (error) {
    throw toError(error, "Could not update the RFP.");
  }

  if (!data) throw new Error("Could not update the RFP.");
  return withRfpDefaults(data);
}

export async function deleteRfp(id: string): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase.from("rfps").delete().eq("id", id);

  if (error) {
    throw toError(error, "Could not delete the RFP.");
  }
}

export async function updateRfpSummary(id: string, summary: string): Promise<Rfp> {
  const supabase = getSupabase();
  const update = { summary, summary_generated_at: new Date().toISOString() };
  const first = await supabase
    .from("rfps")
    .update(update)
    .eq("id", id)
    .select(selectFields)
    .single();
  let data: Partial<Rfp> | null = first.data;
  let error = first.error;

  if (isMissingColumnError(error)) {
    const previous = await supabase.from("rfps").update(update).eq("id", id).select(preDeadlineSelectFields).single();
    data = previous.data as unknown as Partial<Rfp> | null;
    error = previous.error;
  }

  if (error) {
    throw toError(error, "Could not save the RFP summary.");
  }

  if (!data) throw new Error("Could not save the RFP summary.");
  return withRfpDefaults(data);
}

export async function updateRfpResponseDraft(id: string, title: string, content: string): Promise<Rfp> {
  const supabase = getSupabase();
  const update = {
    response_draft_title: title,
    response_draft_content: content,
    response_draft_saved_at: new Date().toISOString(),
  };
  const first = await supabase
    .from("rfps")
    .update(update)
    .eq("id", id)
    .select(selectFields)
    .single();
  let data: Partial<Rfp> | null = first.data;
  let error = first.error;

  if (isMissingColumnError(error)) {
    const previous = await supabase.from("rfps").update(update).eq("id", id).select(preDeadlineSelectFields).single();
    data = previous.data as unknown as Partial<Rfp> | null;
    error = previous.error;
  }

  if (error) {
    throw toError(error, "Could not save the response draft.");
  }

  if (!data) throw new Error("Could not save the response draft.");
  return withRfpDefaults(data);
}
