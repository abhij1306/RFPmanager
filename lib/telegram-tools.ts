import { z } from "zod/v4";
import { getDocumentExcerptForChatgpt, listDocumentSummariesForChatgpt, MAX_DOCUMENT_LIST_LIMIT } from "@/lib/chatgpt-documents";
import { readCompanyProfile } from "@/lib/company-profile";
import { truncate } from "@/lib/display";
import type { ResponseTool } from "@/lib/openai-responses";
import { listRfpDigest } from "@/lib/rfp-queries";
import { getRfp } from "@/lib/rfps";
import { MESSAGE_CHUNK } from "@/lib/telegram";

/**
 * The Telegram bot's tools: what the model can look up (tenders, converted documents, HTC's profile) and its
 * one proposal - a summary draft, which is only saved when a team member taps Save.
 */

const DOCUMENT_READ_LIMIT = 20000;
const PREVIEW_LENGTH = 300;
/** A draft summary is posted as one message whose text is what Save stores, so it must fit in one message. */
const MAX_DRAFT_SUMMARY = MESSAGE_CHUNK;

export const tools: ResponseTool[] = [
  {
    type: "function",
    name: "list_rfps",
    description:
      "List the tenders (RFPs) tracked in RFPmanager: client name, tender code, bid status, pipeline stage, closing date, when a summary was last saved (null if never), and converted document count.",
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
    description: `List the converted (Markdown) documents for one RFP, ${MAX_DOCUMENT_LIST_LIMIT} at a time, with a short preview of each. Never returns raw source files - only converted text.`,
    parameters: {
      type: "object",
      properties: {
        rfp_id: { type: "string", description: "RFP UUID from list_rfps." },
        offset: { type: "integer", description: "Pass next_offset from a previous call to see more documents (default 0)." },
      },
      required: ["rfp_id"],
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "read_rfp_document",
    description:
      "Read a slice of one converted document's Markdown. Pass next_offset from the previous read to page through long documents.",
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
    name: "draft_rfp_summary",
    description: `Propose a summary for an RFP. It is posted under your answer with a Save button; nothing is saved until a team member taps Save. Use it whenever someone asks you to write, update, or save a summary. Plain text, "- " bullets allowed, at most ${MAX_DRAFT_SUMMARY} characters.`,
    parameters: {
      type: "object",
      properties: {
        rfp_id: { type: "string", description: "RFP UUID from list_rfps." },
        summary: { type: "string", description: "The complete summary text, exactly as it should be saved." },
      },
      required: ["rfp_id", "summary"],
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "read_company_profile",
    description:
      "Read HTC Global's own company profile: overview and snapshot (ABN, address, certifications), services, delivery model, implementation methodology, timeline, responsibility matrix, inclusions, case studies, client references, insurance. Only call it when the question is about HTC Global itself or about how HTC fits a tender. Call without section to list the sections, then with a section title (or number) to read it.",
    parameters: {
      type: "object",
      properties: {
        section: { type: "string", description: 'Section title or number, e.g. "Case Studies" or "10". Omit to list sections.' },
      },
      additionalProperties: false,
    },
  },
  { type: "web_search_preview" },
];

const offsetArg = z.coerce.number().int().nonnegative().catch(0);

/** Tool arguments arrive as model-written JSON: parse them here, trust them below. */
const toolCallSchema = z.discriminatedUnion("name", [
  z.object({ name: z.literal("list_rfps"), args: z.object({}) }),
  z.object({ name: z.literal("get_rfp_details"), args: z.object({ rfp_id: z.string().min(1) }) }),
  z.object({
    name: z.literal("list_rfp_documents"),
    args: z.object({ rfp_id: z.string().min(1), offset: offsetArg.optional() }),
  }),
  z.object({
    name: z.literal("read_rfp_document"),
    args: z.object({
      rfp_id: z.string().min(1),
      document_id: z.string().min(1),
      offset: offsetArg.optional(),
      limit: z.coerce.number().int().min(1).max(DOCUMENT_READ_LIMIT).catch(DOCUMENT_READ_LIMIT).optional(),
    }),
  }),
  z.object({ name: z.literal("read_company_profile"), args: z.object({ section: z.string().optional() }) }),
  z.object({
    name: z.literal("draft_rfp_summary"),
    args: z.object({
      rfp_id: z.string().min(1),
      summary: z
        .string()
        .trim()
        .min(1, "Summary text is empty; nothing drafted.")
        .max(MAX_DRAFT_SUMMARY, `Summary is too long for one Telegram message; shorten it to under ${MAX_DRAFT_SUMMARY} characters.`),
    }),
  }),
]);

export type SummaryDraft = { rfpId: string; summary: string; replacesExisting: boolean };

/** What one answer touched, for the buttons under it: the RFPs it looked at and any summary draft. */
export type Turn = { rfpIds: Set<string>; draft: SummaryDraft | null };

/** Shown on the "Looking into it…" message while each tool runs. */
export const TOOL_STATUS = new Map<string, string>([
  ["list_rfps", "Checking the tender list…"],
  ["get_rfp_details", "Looking up the tender…"],
  ["list_rfp_documents", "Checking the tender's documents…"],
  ["read_rfp_document", "Reading the tender documents…"],
  ["read_company_profile", "Checking HTC's company profile…"],
  ["draft_rfp_summary", "Drafting the summary…"],
]);

export async function handleToolCall(name: string, rawArgs: Record<string, unknown>, turn: Turn): Promise<string> {
  const parsed = toolCallSchema.safeParse({ name, args: rawArgs });
  if (!parsed.success) {
    return `Invalid call to ${name}: ${parsed.error.issues.map((issue) => issue.message).join("; ")}`;
  }

  const call = parsed.data;
  switch (call.name) {
    case "list_rfps": {
      const rfps = await listRfpDigest();

      return JSON.stringify(
        rfps.map((rfp) => ({
          id: rfp.id,
          client_name: rfp.client_name,
          tender_code: rfp.tender_code,
          status: rfp.status,
          pipeline_stage: rfp.pipeline_stage,
          closing_date: rfp.closing_date ?? rfp.closing_date_text,
          summary_saved_at: rfp.summary_generated_at,
          document_count: rfp.document_count,
        })),
      );
    }

    case "get_rfp_details": {
      const rfp = await getRfp(call.args.rfp_id);
      if (!rfp) return "RFP not found.";
      turn.rfpIds.add(rfp.id);

      return JSON.stringify({
        id: rfp.id,
        client_name: rfp.client_name,
        tender_code: rfp.tender_code,
        status: rfp.status,
        pipeline_stage: rfp.pipeline_stage,
        closing_date: rfp.closing_date,
        closing_date_text: rfp.closing_date_text,
        tender_link: rfp.tender_link,
        description: rfp.description ? truncate(rfp.description, 2000) : null,
        contact_person: rfp.contact_person,
        contact_email: rfp.contact_email,
        contact_phone: rfp.contact_phone,
        notes: rfp.notes ? truncate(rfp.notes, 2000) : null,
        summary: rfp.summary ? truncate(rfp.summary, 6000) : null,
        summary_generated_at: rfp.summary_generated_at,
      });
    }

    case "list_rfp_documents": {
      const page = await listDocumentSummariesForChatgpt(call.args.rfp_id, {
        offset: call.args.offset ?? 0,
        limit: MAX_DOCUMENT_LIST_LIMIT,
      });
      if (!page) return "RFP not found.";
      turn.rfpIds.add(call.args.rfp_id);
      if (page.total === 0) return "This RFP has no converted documents yet.";

      return JSON.stringify({
        total: page.total,
        next_offset: page.next_offset,
        documents: page.documents.map((doc) => ({
          id: doc.id,
          title: doc.title,
          source_type: doc.source_type,
          length: doc.markdown_length,
          preview: doc.markdown_preview.slice(0, PREVIEW_LENGTH),
        })),
      });
    }

    case "read_rfp_document": {
      const lookup = await getDocumentExcerptForChatgpt(call.args.rfp_id, call.args.document_id, {
        offset: call.args.offset ?? 0,
        limit: call.args.limit ?? DOCUMENT_READ_LIMIT,
      });
      if (lookup.status === "rfp_not_found") return "RFP not found.";
      if (lookup.status === "document_not_found") return "Document not found for this RFP.";
      turn.rfpIds.add(call.args.rfp_id);

      const doc = lookup.document;
      return JSON.stringify({
        title: doc.title,
        offset: doc.offset,
        total_length: doc.markdown_length,
        next_offset: doc.next_offset,
        markdown: doc.markdown,
      });
    }

    case "read_company_profile":
      return readCompanyProfile(call.args.section);

    case "draft_rfp_summary": {
      const rfp = await getRfp(call.args.rfp_id);
      if (!rfp) return "RFP not found.";
      turn.rfpIds.add(rfp.id);
      turn.draft = { rfpId: rfp.id, summary: call.args.summary, replacesExisting: Boolean(rfp.summary) };
      return `Draft ready for ${rfp.client_name}. It will be posted below your answer with a Save button${rfp.summary ? " (saving replaces the current summary)" : ""}. Don't repeat the summary in your answer - just introduce it in a sentence.`;
    }

    default: {
      const _exhaustive: never = call;
      return `Unknown tool: ${JSON.stringify(_exhaustive)}`;
    }
  }
}
