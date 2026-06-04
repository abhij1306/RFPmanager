import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
type UntypedSupabaseClient = SupabaseClient<any, "public", any>;

let supabaseClient: UntypedSupabaseClient | null = null;

export function getSupabase() {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Missing Supabase environment variables. Copy .env.example to .env.local.");
  }

  supabaseClient ??= createClient(supabaseUrl, supabaseAnonKey);

  return supabaseClient;
}
