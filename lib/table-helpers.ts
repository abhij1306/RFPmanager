import { getSupabase } from "@/lib/supabase";
import { toError } from "@/lib/errors";

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
        throw toError(error, `Could not list ${tableName}.`);
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
        throw toError(error, `Could not list ${tableName} for this RFP.`);
      }

      return (data ?? []) as Row[];
    },

    async create(input: Input) {
      const supabase = getSupabase();
      const { data, error } = await supabase.from(tableName).insert(input as never).select(selectFields).single();

      if (error) {
        throw toError(error, `Could not create a ${tableName} record.`);
      }

      return data as Row;
    },

    async remove(id: string) {
      const supabase = getSupabase();
      const { error } = await supabase.from(tableName).delete().eq("id", id);

      if (error) {
        throw toError(error, `Could not delete the ${tableName} record.`);
      }
    },
  };
}

export async function listCountsByRfp(functionName: string): Promise<RfpCount[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase.rpc(functionName);

  if (error) {
    throw toError(error, `Could not load counts from ${functionName}.`);
  }

  return ((data ?? []) as Array<{ rfp_id: string; count: number | string }>).map((item) => ({
    rfp_id: item.rfp_id,
    count: Number(item.count),
  }));
}

/** PostgREST/Postgres error codes for "this RPC function does not exist (yet)". */
export function isMissingFunctionError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const { code } = error as { code?: unknown };
  return code === "PGRST202" || code === "42883";
}

const MISSING_RPC_RETRY_MS = 5 * 60 * 1000;
const missingRpcUntil = new Map<string, number>();

/**
 * Optional performance RPCs live in supabase/perf-2026-10.sql. Until they are applied, callers fall
 * back to plain table queries. Remember a miss for a few minutes so warm instances don't pay a failed
 * round trip on every request, while still picking the function up soon after it is created.
 */
export function isRpcKnownMissing(functionName: string): boolean {
  const until = missingRpcUntil.get(functionName);
  if (until === undefined) return false;
  if (Date.now() < until) return true;
  missingRpcUntil.delete(functionName);
  return false;
}

export function markRpcMissing(functionName: string): void {
  missingRpcUntil.set(functionName, Date.now() + MISSING_RPC_RETRY_MS);
}

/**
 * Call an optional RPC. Resolves to `null` when the function is not installed so the caller can use its
 * fallback; any other error is thrown.
 */
export async function callOptionalRpc<Row>(
  functionName: string,
  args: Record<string, unknown> | undefined,
  fallbackMessage: string,
): Promise<Row[] | null> {
  if (isRpcKnownMissing(functionName)) return null;

  const supabase = getSupabase();
  const { data, error } = await supabase.rpc(functionName, args);

  if (error) {
    if (isMissingFunctionError(error)) {
      markRpcMissing(functionName);
      return null;
    }
    throw toError(error, fallbackMessage);
  }

  return (data ?? []) as Row[];
}
