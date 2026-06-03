import { NextResponse } from "next/server";
import { validateSummaryInput } from "@/lib/chatgpt-files";
import { chatgptAuthErrorResponse, validateChatgptApiKey } from "@/lib/chatgpt-auth";
import { getRfp, updateRfpSummary } from "@/lib/rfps";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
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

    const summary = validateSummaryInput(await request.json());
    const updated = await updateRfpSummary(id, summary);
    return NextResponse.json({ rfp: updated, summary: updated.summary });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not save summary." },
      { status: 400 },
    );
  }
}
