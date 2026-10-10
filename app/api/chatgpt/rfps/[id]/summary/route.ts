import { NextResponse } from "next/server";
import { validateSummaryInput } from "@/lib/chatgpt-files";
import { chatgptAuthErrorResponse, validateChatgptApiKey } from "@/lib/chatgpt-auth";
import { isRfpConfirmedMissing, updateRfpSummary } from "@/lib/rfps";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const validation = validateChatgptApiKey(request);

  if (!validation.ok) {
    return chatgptAuthErrorResponse(validation);
  }

  const { id } = await params;

  try {
    // Write first; an update of a missing RFP touches no rows and fails, and only then do we pay for the
    // existence check that turns the failure into a 404.
    const summary = validateSummaryInput(await request.json());
    const updated = await updateRfpSummary(id, summary);
    return NextResponse.json({ rfp: updated, summary: updated.summary });
  } catch (error) {
    if (await isRfpConfirmedMissing(id)) {
      return NextResponse.json({ error: "RFP not found." }, { status: 404 });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not save summary." },
      { status: 400 },
    );
  }
}
