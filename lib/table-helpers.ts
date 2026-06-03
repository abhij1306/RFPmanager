import { getSupabase } from "@/lib/supabase";

export type RfpCount = {
  rfp_id: string;
  count: number;
};

type TableHelpers<Row, Input> = {
  list: () => Promise<Row[]>;
  listByRfp: (rfpId: string) => Promise<Row[]>;
  create: (input: Input) => Promise<Row>;
  remove: (id: string) => Promise<void>;
};

export function createTableHelpers<Row, Input>(tableName: string, selectFields: string): TableHelpers<Row, Input> {
  return {
    async list() {
      const supabase = getSupabase();
      const { data, error } = await supabase.from(tableName).select(selectFields).order("created_at", { ascending: false });

      if (error) {
        throw error;
      }

      return (data ?? []) as Row[];
    },

    async listByRfp(rfpId: string) {
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from(tableName)
        .select(selectFields)
        .eq("rfp_id", rfpId)
        .order("created_at", { ascending: false });

      if (error) {
        throw error;
      }

      return (data ?? []) as Row[];
    },

    async create(input: Input) {
      const supabase = getSupabase();
      const { data, error } = await supabase.from(tableName).insert(input as never).select(selectFields).single();

      if (error) {
        throw error;
      }

      return data as Row;
    },

    async remove(id: string) {
      const supabase = getSupabase();
      const { error } = await supabase.from(tableName).delete().eq("id", id);

      if (error) {
        throw error;
      }
    },
  };
}

export async function listCountsByRfp(functionName: string): Promise<RfpCount[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase.rpc(functionName);

  if (error) {
    throw error;
  }

  return ((data ?? []) as Array<{ rfp_id: string; count: number | string }>).map((item) => ({
    rfp_id: item.rfp_id,
    count: Number(item.count),
  }));
}
