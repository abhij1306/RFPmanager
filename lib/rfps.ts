import { getSupabase } from "@/lib/supabase";
import type { Rfp, RfpInput } from "@/lib/types";

const selectFields = "id, client_name, status, closing_date, tender_code, tender_link, gdrive_link, notes, pipeline_stage, created_at";

export async function listRfps(): Promise<Rfp[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("rfps")
    .select(selectFields)
    .order("closing_date", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return data ?? [];
}

export async function getRfp(id: string): Promise<Rfp | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase.from("rfps").select(selectFields).eq("id", id).maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

export async function createRfp(input: RfpInput): Promise<Rfp> {
  const supabase = getSupabase();
  const { data, error } = await supabase.from("rfps").insert(input).select(selectFields).single();

  if (error) {
    throw error;
  }

  return data;
}

export async function updateRfp(id: string, input: RfpInput): Promise<Rfp> {
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
