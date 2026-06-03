import { NextResponse } from "next/server";

export function getBearerToken(request: Request): string | null {
  const authorization = request.headers.get("authorization");
  const match = authorization?.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}

export function unauthorizedResponse() {
  return NextResponse.json({ error: "Missing ChatGPT OAuth bearer token." }, { status: 401 });
}
