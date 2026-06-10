import { NextResponse } from "next/server";
import { chatgptAuthErrorResponse, validateChatgptApiKey } from "@/lib/chatgpt-auth";
import { filterRfpsForChatgpt, paginateRfpsForChatgpt } from "@/lib/chatgpt-rfps";
import { createRfp, listRfps, normalizeImportedRfp } from "@/lib/rfps";
import type { RfpImportInput } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const validation = validateChatgptApiKey(request);

  if (!validation.ok) {
    return chatgptAuthErrorResponse(validation);
  }

  try {
    const searchParams = new URL(request.url).searchParams;
    const search = searchParams.get("search");
    const rawOffset = searchParams.get("offset");
    const rawLimit = searchParams.get("limit");
    const offset = rawOffset !== null && !Number.isNaN(Number(rawOffset)) ? Number(rawOffset) : 0;
    const limit = rawLimit !== null && !Number.isNaN(Number(rawLimit)) ? Number(rawLimit) : 0;
    const filteredRfps = filterRfpsForChatgpt(await listRfps(), search);

    return NextResponse.json(paginateRfpsForChatgpt(filteredRfps, { offset, limit }));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not list RFPs." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const validation = validateChatgptApiKey(request);

  if (!validation.ok) {
    return chatgptAuthErrorResponse(validation);
  }

  try {
    const payload = (await request.json()) as RfpImportInput;

    if (typeof payload.client_name !== "string" || !payload.client_name.trim()) {
      return NextResponse.json({ error: "client_name is required." }, { status: 400 });
    }

    const input = normalizeImportedRfp(payload);
    const rfp = await createRfp(input);

    return NextResponse.json({ rfp }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not create RFP." },
      { status: 500 },
    );
  }
}
