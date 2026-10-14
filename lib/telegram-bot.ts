import { z } from "zod/v4";
import { readCompanyProfile } from "@/lib/company-profile";
import { getDocumentExcerptForChatgpt, listDocumentSummariesForChatgpt, MAX_DOCUMENT_LIST_LIMIT } from "@/lib/chatgpt-documents";
import { listRfpDigest } from "@/lib/rfp-queries";
import { getRfp, updateRfpSummary } from "@/lib/rfps";
import { runResponsesTurn, type ResponseTool } from "@/lib/openai-responses";
import { loadMemory, memoryToInput, supabaseExchangeStore, type Memory } from "@/lib/telegram-memory";
import {
  getBotUser,
  isChatMember,
  sendChatTyping,
  sendTelegramMessage,
  type TelegramMessage,
  type TelegramMessageEntity,
} from "@/lib/telegram";

/**
 * Group brainstorm bot: answers whoever asked, reads only converted documents (rfp_documents.markdown),
 * and has exactly one write - saving an RFP summary when someone asks for it. On-demand only: the webhook
 * is the sole entry point, nothing here runs on a schedule. Only chats listed in TELEGRAM_ALLOWED_CHAT_IDS
 * (and private chats with members of those chats) get answers.
 */

const DOCUMENT_READ_LIMIT = 20000;
const PREVIEW_LENGTH = 300;
const EMPTY_QUESTION = "Hi! What would you like to know about our tenders?";

export type BotIdentity = {
  id: number;
  username: string;
};

export type Engagement =
  | { respond: false }
  | { respond: true; kind: "question"; question: string }
  | { respond: true; kind: "help" }
  | { respond: true; kind: "clear" };

/** Shown for /help and /start: answered locally, no model call. */
export const HELP_TEXT = [
  "I'm the RFPmanager bot. I read our tenders and their converted documents, and I can search the web.",
  "",
  "In this group, @mention me, reply to one of my messages, or use a command:",
  "/ask <question> - ask anything",
  "/tenders - all tenders with status and closing dates",
  "/due [days] - tenders closing soon (default 14 days)",
  "/summary <tender> - write and save a summary from its documents",
  "/clear - make me forget our conversation in this chat",
  "/help - this message",
].join("\n");

/** Each command turns its argument text into the question the model answers. */
const COMMANDS: Record<string, (rest: string) => string> = {
  ask: (rest) => rest || EMPTY_QUESTION,
  tenders: (rest) =>
    `List all our tenders with bid status, pipeline stage and closing date, soonest closing first.${rest ? ` Focus on: ${rest}` : ""}`,
  due: (rest) => {
    const days = Number.parseInt(rest, 10) > 0 ? Number.parseInt(rest, 10) : 14;
    return `Today is ${new Date().toISOString().slice(0, 10)}. Which tenders close in the next ${days} days? Give each one's closing date and status.`;
  },
  summary: (rest) =>
    rest
      ? `Write a summary for the tender "${rest}" from its converted documents and save it.`
      : "I want a tender summary written and saved but did not say which tender. Ask me which one, listing the candidates.",
};

/**
 * Decide whether a message is addressed to the bot, and what the actual question is. In groups that means an
 * exact @mention, a reply to one of the bot's messages, or one of the bot's commands (commands reach the bot
 * even with privacy mode on). Private chats are always addressed to the bot.
 */
export function engagementFor(message: TelegramMessage, bot: BotIdentity): Engagement {
  const text = message.text ?? message.caption ?? "";
  if (!text.trim()) return { respond: false };

  const entities = message.text !== undefined ? message.entities : message.caption_entities;
  const ownMentions = findOwnMentions(text, entities, bot.username);
  const command = leadingCommand(text, entities, bot.username);
  const isPrivate = message.chat.type === "private";

  if (command) {
    if (command.name === "help" || command.name === "start") return { respond: true, kind: "help" };
    if (command.name === "clear") return { respond: true, kind: "clear" };
    // hasOwn so /constructor or /tostring can't reach Object.prototype.
    const toQuestion = Object.hasOwn(COMMANDS, command.name) ? COMMANDS[command.name] : undefined;
    const rest = removeRanges(text, [command, ...ownMentions]);
    if (toQuestion) return asQuestion(toQuestion(rest));
    // Unknown commands: ours when addressed to us or in a DM; in a group a bare /cmd may be for another bot.
    if (command.addressedToUs || isPrivate) return { respond: true, kind: "help" };
    return { respond: false };
  }

  if (isPrivate) return asQuestion(removeRanges(text, ownMentions));

  const replyToBot =
    message.reply_to_message?.from?.is_bot === true &&
    (message.reply_to_message.from.id === bot.id ||
      message.reply_to_message.from.username?.toLowerCase() === bot.username.toLowerCase());

  if (ownMentions.length === 0 && !replyToBot) return { respond: false };
  return asQuestion(removeRanges(text, ownMentions));
}

function asQuestion(text: string): Engagement {
  return { respond: true, kind: "question", question: text || EMPTY_QUESTION };
}

type TextRange = { offset: number; length: number };

/** Exact @username mentions of this bot. Uses Telegram's entities; falls back to a whole-token match without them. */
function findOwnMentions(text: string, entities: TelegramMessageEntity[] | undefined, username: string): TextRange[] {
  if (!username) return [];
  const mention = `@${username}`.toLowerCase();

  if (entities) {
    return entities.filter(
      (entity) => entity.type === "mention" && text.slice(entity.offset, entity.offset + entity.length).toLowerCase() === mention,
    );
  }

  const pattern = new RegExp(`(?<![\\w@.])@${escapeRegExp(username)}(?!\\w)`, "gi");
  return Array.from(text.matchAll(pattern), (match) => ({ offset: match.index, length: match[0].length }));
}

type CommandRange = TextRange & { name: string; addressedToUs: boolean };

/** A /command at the very start of the message, unless it is addressed to a different bot (/cmd@other_bot). */
function leadingCommand(text: string, entities: TelegramMessageEntity[] | undefined, username: string): CommandRange | null {
  const entity = entities?.find((item) => item.type === "bot_command" && item.offset === 0);
  const raw = entity ? text.slice(0, entity.length) : (text.match(/^\/[A-Za-z0-9_]+(?:@[A-Za-z0-9_]+)?/)?.[0] ?? null);
  if (!raw) return null;

  const [name, target] = raw.slice(1).split("@");
  if (target && target.toLowerCase() !== username.toLowerCase()) return null;
  return { offset: 0, length: raw.length, name: name.toLowerCase(), addressedToUs: Boolean(target) };
}

function removeRanges(text: string, ranges: TextRange[]): string {
  let result = text;
  for (const range of [...ranges].sort((a, b) => b.offset - a.offset)) {
    result = result.slice(0, range.offset) + result.slice(range.offset + range.length);
  }
  return result.replace(/[ \t]{2,}/g, " ").trim();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Chat IDs from a comma/space separated env value, e.g. "-1001234567890, -1009876543210". Tolerates what a
 * dashboard paste tends to add: quotes, brackets, a leading "NAME=" and typographic minus signs.
 */
export function parseAllowedChatIds(value: string | undefined): Set<number> {
  const cleaned = (value ?? "")
    .replace(/^\s*TELEGRAM_ALLOWED_CHAT_IDS\s*=/i, "")
    .replace(/["'`[\]]/g, "")
    .replace(/[−–—]/g, "-");

  return new Set(
    cleaned
      .split(/[\s,;]+/)
      .map((item) => Number(item))
      .filter((id) => Number.isSafeInteger(id) && id !== 0),
  );
}

export type ChatAccess = "allowed" | "chat_not_allowed" | "not_a_member";

/**
 * Groups must be on the allowlist. Private chats are allowed for anyone who is a member of an allowed group,
 * so the team can DM the bot but strangers who find it cannot read tender data.
 */
export async function chatAccess(
  message: TelegramMessage,
  allowedChatIds: Set<number>,
  isMember: (chatId: number, userId: number) => Promise<boolean> = isChatMember,
): Promise<ChatAccess> {
  if (message.chat.type !== "private") {
    return allowedChatIds.has(message.chat.id) ? "allowed" : "chat_not_allowed";
  }

  const userId = message.from?.id;
  if (!userId) return "not_a_member";

  for (const chatId of allowedChatIds) {
    if (await isMember(chatId, userId).catch(() => false)) return "allowed";
  }
  return "not_a_member";
}

/** Says what this deployment actually loaded (a count, never the other IDs) so a bad env value is easy to spot. */
export function accessDeniedReply(
  access: Exclude<ChatAccess, "allowed">,
  message: TelegramMessage,
  allowedCount: number,
): string {
  switch (access) {
    case "chat_not_allowed":
      return [
        "This group isn't enabled for the RFPmanager bot yet.",
        `Chat ID: ${message.chat.id}`,
        allowedCount === 0
          ? "This deployment has no allowed chat IDs: TELEGRAM_ALLOWED_CHAT_IDS is missing for Production, empty, or not a number. Set it to the chat ID above and redeploy."
          : `This deployment allows ${allowedCount} other chat ID${allowedCount === 1 ? "" : "s"}, but not this one. Make TELEGRAM_ALLOWED_CHAT_IDS match the chat ID above exactly (minus sign included) and redeploy.`,
      ].join("\n");
    case "not_a_member":
      return "Sorry, I only answer members of the team's RFPmanager group.";
    default: {
      const _exhaustive: never = access;
      return _exhaustive;
    }
  }
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
    name: z.literal("save_rfp_summary"),
    args: z.object({ rfp_id: z.string().min(1), summary: z.string().trim().min(1, "Summary text is empty; nothing saved.") }),
  }),
]);

async function handleToolCall(name: string, rawArgs: Record<string, unknown>): Promise<string> {
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
      const page = await listDocumentSummariesForChatgpt(call.args.rfp_id, {
        offset: call.args.offset ?? 0,
        limit: MAX_DOCUMENT_LIST_LIMIT,
      });
      if (!page) return "RFP not found.";
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

    case "save_rfp_summary": {
      const updated = await updateRfpSummary(call.args.rfp_id, call.args.summary);
      return JSON.stringify({ saved: true, rfp: updated.client_name, saved_at: updated.summary_generated_at });
    }

    default: {
      const _exhaustive: never = call;
      return `Unknown tool: ${JSON.stringify(_exhaustive)}`;
    }
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
    "HTC Global is our company. For questions about HTC itself (capabilities, case studies, references, certifications, insurance, methodology, ABN, address) or whether HTC fits a tender, read the relevant section with read_company_profile - only the sections you need, and not for questions that don't involve HTC. If you quote insurance or other dated details, say when they expire and flag any that have already expired.",
    "Earlier messages from this conversation may come before the new question. Use them to resolve follow-ups like 'that tender' or 'the second one', but answer only the newest question.",
    "You are read-only apart from saving summaries: you cannot create, edit, or delete RFPs, documents, or drafts. Decline such requests briefly.",
    "If a question is ambiguous about which RFP it means, ask a short clarifying question naming the candidates.",
  ].join("\n");
}

/** Answer one question that was already confirmed as addressed to the bot. */
export async function answerQuestion(
  message: TelegramMessage,
  question: string,
  { memory, signal }: { memory?: Memory; signal?: AbortSignal } = {},
): Promise<string> {
  const asker = senderDisplayName(message);

  return runResponsesTurn({
    instructions: buildInstructions(asker),
    history: memory ? memoryToInput(memory) : [],
    input: `${asker} asks: ${question}`,
    tools,
    onFunctionCall: handleToolCall,
    signal,
  });
}

const TYPING_REFRESH_MS = 4500;

/** Memory is best effort: a missing table or failed query means answering without it, never failing. */
async function loadMemorySafely(message: TelegramMessage, botId: number): Promise<Memory | undefined> {
  try {
    return await loadMemory(message, botId);
  } catch (error) {
    console.warn("Telegram bot answering without memory:", error);
    return undefined;
  }
}

/**
 * Handle one incoming message end to end. Nothing is sent unless the message is addressed to the bot, and
 * the apology is only sent when producing the answer failed - never after a partly delivered answer.
 * Answered questions are remembered so replies and follow-ups have context.
 */
export async function handleTelegramMessage(message: TelegramMessage, { deadlineMs }: { deadlineMs: number }): Promise<void> {
  const botUser = await getBotUser();
  const engagement = engagementFor(message, { id: botUser.id, username: botUser.username ?? "" });
  if (!engagement.respond) return;

  const allowedChatIds = parseAllowedChatIds(process.env.TELEGRAM_ALLOWED_CHAT_IDS);
  const access = await chatAccess(message, allowedChatIds);
  if (access !== "allowed") {
    console.warn("Telegram bot refused chat:", { chatId: message.chat.id, access, allowedCount: allowedChatIds.size });
    await sendTelegramMessage(message.chat.id, message.message_id, accessDeniedReply(access, message, allowedChatIds.size));
    return;
  }

  if (engagement.kind === "help") {
    await sendTelegramMessage(message.chat.id, message.message_id, HELP_TEXT);
    return;
  }

  if (engagement.kind === "clear") {
    const reply = await supabaseExchangeStore.clearChat(message.chat.id).then(
      (count) => `Done - I've forgotten ${count} earlier exchange${count === 1 ? "" : "s"} in this chat. We're starting fresh.`,
      (error: unknown) => {
        console.error("Telegram bot could not clear memory:", error);
        return "Sorry, I couldn't clear my memory just now. Please try again in a moment.";
      },
    );
    await sendTelegramMessage(message.chat.id, message.message_id, reply);
    return;
  }

  // Telegram clears "typing" after ~5s, so keep it alive while the model works.
  const showTyping = () => void sendChatTyping(message.chat.id).catch(() => undefined);
  showTyping();
  const typing = setInterval(showTyping, TYPING_REFRESH_MS);

  let outcome: { answered: true; text: string } | { answered: false; text: string };
  try {
    const memory = await loadMemorySafely(message, botUser.id);
    const text = await answerQuestion(message, engagement.question, { memory, signal: AbortSignal.timeout(deadlineMs) });
    outcome = { answered: true, text };
  } catch (error) {
    console.error("Telegram bot failed to answer:", error);
    outcome = {
      answered: false,
      text:
        error instanceof Error && error.name === "TimeoutError"
          ? "Sorry, that took too long to work out. Try a narrower question (one tender or one document at a time)."
          : "Sorry, something went wrong on my side. Please try again in a moment.",
    };
  } finally {
    clearInterval(typing);
  }

  const botMessageIds = await sendTelegramMessage(message.chat.id, message.message_id, outcome.text);
  if (!outcome.answered) return;

  const parent = message.reply_to_message;
  await supabaseExchangeStore
    .insert({
      chat_id: message.chat.id,
      question_message_id: message.message_id,
      reply_to_bot_message_id: parent?.from?.id === botUser.id ? parent.message_id : null,
      bot_message_ids: botMessageIds,
      asker_name: senderDisplayName(message),
      question: engagement.question,
      answer: outcome.text,
    })
    .catch((error: unknown) => console.warn("Telegram bot could not remember this exchange:", error));
}
