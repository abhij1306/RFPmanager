import { NextResponse } from "next/server";
import { getBearerToken, unauthorizedResponse } from "@/lib/chatgpt-auth";
import { getSupabaseWithAccessToken } from "@/lib/supabase";
import { normalizeImportedRfp } from "@/lib/rfps";
import type { Rfp, RfpImportInput } from "@/lib/types";

const selectFields =
  "id, client_name, status, closing_date, tender_code, tender_link, gdrive_link, description, contact_person, contact_phone, contact_email, document_links, summary, summary_generated_at, notes, pipeline_stage, created_at";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const accessToken = getBearerToken(request);

  if (!accessToken) {
    return unauthorizedResponse();
  }

  const supabase = getSupabaseWithAccessToken(accessToken);
  const { data, error } = await supabase
    .from("rfps")
    .select(selectFields)
    .order("closing_date", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ rfps: data ?? [] });
}

export async function POST(request: Request) {
  const accessToken = getBearerToken(request);

  if (!accessToken) {
    return unauthorizedResponse();
  }

  try {
    const payload = (await request.json()) as RfpImportInput;

    if (typeof payload.client_name !== "string" || !payload.client_name.trim()) {
      return NextResponse.json({ error: "client_name is required." }, { status: 400 });
    }

    const supabase = getSupabaseWithAccessToken(accessToken);
    const input = normalizeImportedRfp(payload);
    const { data, error } = await supabase.from("rfps").insert(input).select(selectFields).single<Rfp>();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ rfp: data }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not create RFP." },
      { status: 500 },
    );
  }
}
