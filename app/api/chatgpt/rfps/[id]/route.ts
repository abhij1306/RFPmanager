import { NextResponse } from "next/server";
import { chatgptAuthErrorResponse, validateChatgptApiKey } from "@/lib/chatgpt-auth";
import { getRfp, normalizeRfpUpdate, updateRfp } from "@/lib/rfps";
import type { RfpUpdateInput } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const validation = validateChatgptApiKey(request);

  if (!validation.ok) {
    return chatgptAuthErrorResponse(validation);
  }

  try {
    const { id } = await params;
    const rfp = await getRfp(id);

    if (!rfp) {
      return NextResponse.json({ error: "RFP not found." }, { status: 404 });
    }

    return NextResponse.json({ rfp });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not load RFP." }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const validation = validateChatgptApiKey(request);

  if (!validation.ok) {
    return chatgptAuthErrorResponse(validation);
  }

  try {
    const { id } = await params;
    const payload = normalizeRfpUpdate((await request.json()) as RfpUpdateInput);
    const rfp = await updateRfp(id, payload);

    return NextResponse.json({ rfp });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not update RFP." },
      { status: 500 },
    );
  }
}
