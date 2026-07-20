import { NextResponse } from "next/server";
import { listDocumentMetadataPage } from "@/lib/documents";

export const dynamic = "force-dynamic";

function readPositiveInteger(value: string | null, fallback: number, maximum: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? Math.min(parsed, maximum) : fallback;
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const searchParams = new URL(request.url).searchParams;
  const offset = readPositiveInteger(searchParams.get("offset"), 0, Number.MAX_SAFE_INTEGER);
  const limit = readPositiveInteger(searchParams.get("limit"), 25, 100);
  const page = await listDocumentMetadataPage({ limit, offset, rfpId: id });

  return NextResponse.json(page);
}
