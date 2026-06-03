import { NextResponse } from "next/server";
import { getBearerToken, unauthorizedResponse } from "@/lib/chatgpt-auth";
import { getSupabaseWithAccessToken } from "@/lib/supabase";
import type { RfpInput } from "@/lib/types";

const selectFields =
  "id, client_name, status, closing_date, tender_code, tender_link, gdrive_link, description, contact_person, contact_phone, contact_email, document_links, summary, summary_generated_at, notes, pipeline_stage, created_at";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const accessToken = getBearerToken(request);

  if (!accessToken) {
    return unauthorizedResponse();
  }

  const { id } = await params;
  const supabase = getSupabaseWithAccessToken(accessToken);
  const { data, error } = await supabase.from("rfps").select(selectFields).eq("id", id).maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ error: "RFP not found." }, { status: 404 });
  }

  return NextResponse.json({ rfp: data });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const accessToken = getBearerToken(request);

  if (!accessToken) {
    return unauthorizedResponse();
  }

  try {
    const { id } = await params;
    const payload = (await request.json()) as Partial<RfpInput>;
    const supabase = getSupabaseWithAccessToken(accessToken);
    const { data, error } = await supabase.from("rfps").update(payload).eq("id", id).select(selectFields).single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ rfp: data });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not update RFP." },
      { status: 500 },
    );
  }
}
