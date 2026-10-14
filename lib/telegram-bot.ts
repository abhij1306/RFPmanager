import { listRfpIndex } from "@/lib/rfp-queries";
import { getRfp, listRfps, updateRfpSummary } from "@/lib/rfps";
import { getDocumentByRfp, listDocumentsByRfp } from "@/lib/documents";
import { runResponsesTurn, type ResponseTool } from "@/lib/openai-responses";
import type { TelegramMessage } from "@/lib/telegram";

/**
 * Group brainstorm bot: answers whoever asked, reads only converted documents (rfp_documents.markdown),
 * and has exactly one write - saving an RFP summary when someone asks for it. On-demand only: the webhook
 * is the sole entry point, nothing here runs on a schedule.
 */

const DOCUMENT_READ_LIMIT = 20000;
const MAX_DOCUMENTS_PER_READ = 25;

export type BotIdentity = {
  id: number;
  username: string;
};

export type Engagement =
  | { respond: false }
  | { respond: true; question: string };

/** Decide whether a message is addressed to the bot, and what the actual question is. */
export function engagementFor(message: TelegramMessage, bot: BotIdentity): Engagement {
  const text = (message.text ?? message.caption ?? "").trim();
  if (!text) return { respond: false };

  if (message.chat.type === "private") {
    return { respond: true, question: text };
  }

  const mention = `@${bot.username}`.toLowerCase();

  const mentioned = text.toLowerCase().includes(mention);
  const replyToBot =
    message.reply_to_message?.from?.is_bot === true &&
    (message.reply_to_message.from.id === bot.id ||
      message.reply_to_message.from.username?.toLowerCase() === bot.username.toLowerCase());

  if (!mentioned && !replyToBot) return { respond: false };

  const question = mentioned ? text.replace(new RegExp(escapeRegExp(`@${bot.username}`), "gi"), "").trim() : text;
  return { respond: true, question: question || "Hi! What would you like to know about our tenders?" };
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function senderDisplayName(message: TelegramMessage): string {
  const from = message.from;
  if (!from) return "there";
  return [from.first_name, from.last_name].filter(Boolean).join(" ").trim() || from.username || "there";
}

function truncate(value: string | null | undefined, limit: number): string | null {
  if (!value) return null;
  return value.length > limit ? `${value.slice(0, limit)}...` : value;
}

const tools: ResponseTool[] = [
  {
    type: "function",
    name: "list_rfps",
    description:
      "List the tenders (RFPs) tracked in RFPmanager: client name, tender code, bid status, pipeline stage, closing date, whether a summary exists, and converted document count.",
    parameters: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "get_rfp_details",
    description: "Get one RFP's full metadata and saved summary. Use the id from list_rfps.",
    parameters: {
      type: "object",
      properties: {
        rfp_id: { type: "string", description: "RFP UUID from list_rfps." },
      },
      required: ["rfp_id"],
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "list_rfp_documents",
    description:
      "List the converted (Markdown) documents for one RFP, with a short preview of each. Never returns raw source files - only converted text.",
    parameters: {
      type: "object",
      properties: {
        rfp_id: { type: "string", description: "RFP UUID from list_rfps." },
      },
      required: ["rfp_id"],
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "read_rfp_document",
    description:
      "Read a slice of one converted document's Markdown. Use offset to page through long documents.",
    parameters: {
      type: "object",
      properties: {
        rfp_id: { type: "string", description: "RFP UUID from list_rfps." },
        document_id: { type: "string", description: "Document UUID from list_rfp_documents." },
        offset: { type: "integer", description: "Character offset to start from (default 0)." },
        limit: { type: "integer", description: `Characters to return (default ${DOCUMENT_READ_LIMIT}, max ${DOCUMENT_READ_LIMIT}).` },
      },
      required: ["rfp_id", "document_id"],
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "save_rfp_summary",
    description:
      "Save a summary onto an RFP record. This is the bot's only write. Use it whenever a team member asks you to write, update, or save a summary - no confirmation needed, save directly and say it is saved.",
    parameters: {
      type: "object",
      properties: {
        rfp_id: { type: "string", description: "RFP UUID from list_rfps." },
        summary: { type: "string", description: "The complete summary text to save." },
      },
      required: ["rfp_id", "summary"],
      additionalProperties: false,
    },
  },
  { type: "web_search_preview" },
];

async function handleToolCall(name: string, args: Record<string, unknown>): Promise<string> {
  switch (name) {
    case "list_rfps": {
      const [rfps, index] = await Promise.all([listRfps(), listRfpIndex()]);
      const counts = new Map(index.map((row) => [row.id, row.document_count]));

      return JSON.stringify(
        rfps.map((rfp) => ({
          id: rfp.id,
          client_name: rfp.client_name,
          tender_code: rfp.tender_code,
          status: rfp.status,
          pipeline_stage: rfp.pipeline_stage,
          closing_date: rfp.closing_date ?? rfp.closing_date_text,
          has_summary: Boolean(rfp.summary),
          document_count: counts.get(rfp.id) ?? 0,
        })),
      );
    }

    case "get_rfp_details": {
      const rfp = await getRfp(String(args.rfp_id ?? ""));
      if (!rfp) return "RFP not found.";

      return JSON.stringify({
        id: rfp.id,
        client_name: rfp.client_name,
        tender_code: rfp.tender_code,
        status: rfp.status,
        pipeline_stage: rfp.pipeline_stage,
        closing_date: rfp.closing_date,
        closing_date_text: rfp.closing_date_text,
        tender_link: rfp.tender_link,
        description: truncate(rfp.description, 2000),
        contact_person: rfp.contact_person,
        contact_email: rfp.contact_email,
        contact_phone: rfp.contact_phone,
        notes: truncate(rfp.notes, 2000),
        summary: truncate(rfp.summary, 6000),
        summary_generated_at: rfp.summary_generated_at,
      });
    }

    case "list_rfp_documents": {
      const documents = await listDocumentsByRfp(String(args.rfp_id ?? ""));
      if (documents.length === 0) return "This RFP has no converted documents yet.";

      return JSON.stringify(
        documents.slice(0, MAX_DOCUMENTS_PER_READ).map((doc) => ({
          id: doc.id,
          title: doc.title,
          source_type: doc.source_type,
          length: doc.markdown.length,
          preview: doc.markdown.slice(0, 300),
        })),
      );
    }

    case "read_rfp_document": {
      const rfpId = String(args.rfp_id ?? "");
      const documentId = String(args.document_id ?? "");
      const offset = Math.max(0, Number(args.offset) || 0);
      const limit = Math.min(DOCUMENT_READ_LIMIT, Math.max(1, Number(args.limit) || DOCUMENT_READ_LIMIT));

      const doc = await getDocumentByRfp(rfpId, documentId);
      if (!doc) return "Document not found for this RFP.";

      return JSON.stringify({
        title: doc.title,
        offset,
        total_length: doc.markdown.length,
        markdown: doc.markdown.slice(offset, offset + limit),
      });
    }

    case "save_rfp_summary": {
      const rfpId = String(args.rfp_id ?? "");
      const summary = String(args.summary ?? "").trim();
      if (!summary) return "Summary text is empty; nothing saved.";

      const updated = await updateRfpSummary(rfpId, summary);
      return JSON.stringify({ saved: true, rfp: updated.client_name, saved_at: updated.summary_generated_at });
    }

    default:
      return `Unknown tool: ${name}`;
  }
}

function buildInstructions(askerName: string): string {
  return [
    "You are the RFPmanager team bot inside a Telegram group. The team brainstorms about government tenders with you.",
    `You are answering ${askerName}. Address them by name, keep the tone collegial and concise, and format for a chat message (short paragraphs, plain text, no tables, no markdown headers).`,
    "You can only see CONVERTED documents (Markdown extracted from the tender files) through your tools - never raw files. If the converted text does not cover a question, say so plainly instead of guessing.",
    "Use the tools to look up RFPs and read documents before answering factual questions about tenders. Never invent tender details, dates, or requirements.",
    "Web search is unrestricted: use it for anything a member asks about - tender context, agencies, market info, tech, or general knowledge. General questions that need no RFP data are welcome; just answer them (search first when facts could be stale).",
    "When someone asks you to write or save a summary for an RFP, draft it from the converted documents and save it with save_rfp_summary right away - no confirmation step. Then confirm it is saved and paste the summary.",
    "You are read-only apart from saving summaries: you cannot create, edit, or delete RFPs, documents, or drafts. Decline such requests briefly.",
    "If a question is ambiguous about which RFP it means, ask a short clarifying question naming the candidates.",
  ].join("\n");
}

/** Answer one question that was already confirmed as addressed to the bot. */
export async function answerQuestion(message: TelegramMessage, question: string): Promise<string> {
  const asker = senderDisplayName(message);

  return runResponsesTurn({
    instructions: buildInstructions(asker),
    input: `${asker} asks: ${question}`,
    tools,
    onFunctionCall: handleToolCall,
  });
}
