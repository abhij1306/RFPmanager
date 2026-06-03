import { NextResponse } from "next/server";
import { createRfp, normalizeImportedRfp } from "@/lib/rfps";
import type { RfpImportInput } from "@/lib/types";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export function OPTIONS() {
  return new NextResponse(null, { headers: corsHeaders, status: 204 });
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as RfpImportInput;

    if (typeof payload.client_name !== "string" || !payload.client_name.trim()) {
      return NextResponse.json({ error: "client_name is required" }, { headers: corsHeaders, status: 400 });
    }

    const input = normalizeImportedRfp(payload);

    const rfp = await createRfp(input);
    return NextResponse.json({ id: rfp.id, rfp }, { headers: corsHeaders });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not save RFP" },
      { headers: corsHeaders, status: 500 },
    );
  }
}
