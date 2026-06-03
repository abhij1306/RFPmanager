import { getSupabase } from "@/lib/supabase";
import type { RfpDocument, RfpDocumentInput } from "@/lib/types";

const selectFields = "id, rfp_id, title, source_filename, source_type, markdown, created_at";

export async function listDocuments(): Promise<RfpDocument[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("rfp_documents")
    .select(selectFields)
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return data ?? [];
}

export async function listDocumentsByRfp(rfpId: string): Promise<RfpDocument[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("rfp_documents")
    .select(selectFields)
    .eq("rfp_id", rfpId)
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return data ?? [];
}

export async function createDocument(input: RfpDocumentInput): Promise<RfpDocument> {
  const supabase = getSupabase();
  const { data, error } = await supabase.from("rfp_documents").insert(input).select(selectFields).single();

  if (error) {
    throw error;
  }

  return data;
}

export async function deleteDocument(id: string): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase.from("rfp_documents").delete().eq("id", id);

  if (error) {
    throw error;
  }
}
