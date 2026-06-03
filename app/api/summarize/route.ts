import { NextResponse } from "next/server";
import { updateRfpSummary } from "@/lib/rfps";

type SummarizeRequest = {
  markdown: string;
  rfp_id: string;
};

const systemPrompt =
  "You are an expert RFP analyst. Extract structured information from tender documents and produce a concise summary for a bid team.";

function buildPrompt(markdown: string): string {
  return [
    "Analyse this tender document and return:",
    "",
    "- What they want (one paragraph)",
    "- Key requirements (bullet list)",
    "- Evaluation criteria",
    "- Mandatory submission items",
    "- Deadlines",
    "- Red flags / complexity signals",
    "- Fit score rationale for HTC Global's capabilities",
    "",
    markdown,
  ].join("\n");
}

export async function POST(request: Request) {
  const apiKey = process.env.GROQ_API_KEY;

  if (!apiKey) {
    return NextResponse.json({ error: "Missing GROQ_API_KEY environment variable." }, { status: 500 });
  }

  try {
    const payload = (await request.json()) as SummarizeRequest;
    const markdown = payload.markdown?.trim();

    if (!payload.rfp_id || !markdown) {
      return NextResponse.json({ error: "rfp_id and markdown are required." }, { status: 400 });
    }

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: buildPrompt(markdown) },
        ],
        max_tokens: 1500,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json({ error: errorText || "Groq summarization failed." }, { status: response.status });
    }

    const data = await response.json();
    const summary = data.choices?.[0]?.message?.content;

    if (typeof summary !== "string" || !summary.trim()) {
      return NextResponse.json({ error: "Groq returned an empty summary." }, { status: 502 });
    }

    const rfp = await updateRfpSummary(payload.rfp_id, summary.trim());
    return NextResponse.json({ rfp, summary: rfp.summary });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not summarize RFP." }, { status: 500 });
  }
}
