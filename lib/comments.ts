import { getSupabase } from "@/lib/supabase";
import type { RfpComment, RfpCommentInput } from "@/lib/types";

const selectFields = "id, rfp_id, author_name, body, created_at";

export async function listComments(): Promise<RfpComment[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("rfp_comments")
    .select(selectFields)
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return data ?? [];
}

export async function listCommentsByRfp(rfpId: string): Promise<RfpComment[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("rfp_comments")
    .select(selectFields)
    .eq("rfp_id", rfpId)
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return data ?? [];
}

export async function createComment(input: RfpCommentInput): Promise<RfpComment> {
  const supabase = getSupabase();
  const { data, error } = await supabase.from("rfp_comments").insert(input).select(selectFields).single();

  if (error) {
    throw error;
  }

  return data;
}

export async function deleteComment(id: string): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase.from("rfp_comments").delete().eq("id", id);

  if (error) {
    throw error;
  }
}
