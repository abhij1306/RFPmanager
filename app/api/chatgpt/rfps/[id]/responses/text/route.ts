import { NextResponse } from "next/server";
import { ValidationError, validateResponseDraftInput } from "@/lib/chatgpt-files";
import { chatgptAuthErrorResponse, validateChatgptApiKey } from "@/lib/chatgpt-auth";
import { isRfpConfirmedMissing, updateRfpResponseDraft } from "@/lib/rfps";

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
    const draft = validateResponseDraftInput(await request.json());
    const updated = await updateRfpResponseDraft(id, draft.title, draft.content);

    return NextResponse.json({
      rfp: updated,
      response_draft: {
        title: updated.response_draft_title,
        content: updated.response_draft_content,
        saved_at: updated.response_draft_saved_at,
      },
    });
  } catch (error) {
    if (await isRfpConfirmedMissing(id)) {
      return NextResponse.json({ error: "RFP not found." }, { status: 404 });
    }

    const isValidationError = error instanceof ValidationError || (error instanceof Error && error.name === "ValidationError");

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not save response draft." },
      { status: isValidationError ? 400 : 500 },
    );
  }
}
