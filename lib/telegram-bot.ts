import { listRfpDigest } from "@/lib/rfp-queries";
import { updateRfpSummary } from "@/lib/rfps";
import { rfpPageUrl } from "@/lib/app-url";
import { runResponsesTurn, type HistoryItem } from "@/lib/openai-responses";
import { buildDigest, sydneyNow } from "@/lib/telegram-digest";
import { loadMemory, memoryToInput, rememberExchange, supabaseExchangeStore, type Memory } from "@/lib/telegram-memory";
import { startProgress } from "@/lib/telegram-progress";
import { handleToolCall, tools, TOOL_STATUS, type SummaryDraft, type Turn } from "@/lib/telegram-tools";
import {
  answerCallbackQuery,
  displayName,
  editButtons,
  getBotUser,
  isChatMember,
  sendTelegramMessage,
  toParts,
  type InlineButton,
  type InlineKeyboard,
  type OutgoingText,
  type TelegramCallbackQuery,
  type TelegramMessage,
  type TelegramMessageEntity,
} from "@/lib/telegram";

/**
 * Group brainstorm bot: answers whoever asked, reads only converted documents (rfp_documents.markdown),
 * and has exactly one write - saving an RFP summary, and only when a team member taps Save under a draft.
 * The webhook is the entry point; the only scheduled job is the weekly digest (lib/telegram-digest.ts).
 * Only chats listed in TELEGRAM_ALLOWED_CHAT_IDS (and private chats with members of those chats) get answers.
 */

const EMPTY_QUESTION = "Hi! What would you like to know about our tenders?";

export type BotIdentity = {
  id: number;
  username: string;
};

export type Engagement =
  | { respond: false }
  | { respond: true; kind: "question"; question: string }
  | { respond: true; kind: "help" }
  | { respond: true; kind: "clear" }
  | { respond: true; kind: "digest" };

/** Shown for /help and /start: answered locally, no model call. */
export const HELP_TEXT = [
  "I'm the RFPmanager bot. I read our tenders and their converted documents, and I can search the web.",
  "",
  "In this group, @mention me, reply to one of my messages, or use a command:",
  "/ask <question> - ask anything",
  "/tenders - all tenders with status and closing dates",
  "/due [days] - tenders closing soon (default 14 days)",
  "/summary <tender> - draft a summary from its documents (tap Save to keep it)",
  "/digest - tenders closing in the next 14 days (also posted every Monday)",
  "/clear - make me forget our conversation in this chat",
  "/help - this message",
].join("\n");

const HELP: Engagement = { respond: true, kind: "help" };

/** Every command the bot answers: each turns its argument text into what the bot does. */
const COMMANDS = new Map<string, (rest: string) => Engagement>([
  ["ask", (rest) => asQuestion(rest)],
  [
    "tenders",
    (rest) =>
      asQuestion(`List all our tenders with bid status, pipeline stage and closing date, soonest closing first.${rest ? ` Focus on: ${rest}` : ""}`),
  ],
  [
    "due",
    (rest) => {
      const days = Number.parseInt(rest, 10) > 0 ? Number.parseInt(rest, 10) : 14;
      return asQuestion(
        `Today is ${new Date().toISOString().slice(0, 10)}. Which tenders close in the next ${days} days? Give each one's closing date and status.`,
      );
    },
  ],
  [
    "summary",
    (rest) =>
      asQuestion(
        rest
          ? `Draft a summary for the tender "${rest}" from its converted documents.`
          : "I want a tender summary drafted but did not say which tender. Ask me which one, listing the candidates.",
      ),
  ],
  ["digest", () => ({ respond: true, kind: "digest" })],
  ["clear", () => ({ respond: true, kind: "clear" })],
  ["help", () => HELP],
  ["start", () => HELP],
]);

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
    const toEngagement = COMMANDS.get(command.name);
    if (toEngagement) return toEngagement(removeRanges(text, [command, ...ownMentions]));
    // Unknown commands: ours when addressed to us or in a DM; in a group a bare /cmd may be for another bot.
    if (command.addressedToUs || isPrivate) return HELP;
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

/** This deployment's allowlist (TELEGRAM_ALLOWED_CHAT_IDS). */
export function allowedChatIds(): Set<number> {
  return parseAllowedChatIds(process.env.TELEGRAM_ALLOWED_CHAT_IDS);
}

/** The allowed group chats (Telegram group IDs are negative; positive IDs are people). */
export function allowedGroupIds(): number[] {
  return [...allowedChatIds()].filter((id) => id < 0);
}

export type ChatAccess = "allowed" | "chat_not_allowed" | "not_a_member";

/**
 * Groups must be on the allowlist. Private chats are allowed for anyone who is a member of an allowed group,
 * so the team can DM the bot but strangers who find it cannot read tender data.
 */
export async function chatAccess(
  { chat, userId }: { chat: TelegramMessage["chat"]; userId: number | undefined },
  allowed: Set<number>,
  isMember: (chatId: number, userId: number) => Promise<boolean> = isChatMember,
): Promise<ChatAccess> {
  if (chat.type !== "private") {
    return allowed.has(chat.id) ? "allowed" : "chat_not_allowed";
  }

  if (!userId) return "not_a_member";

  for (const chatId of allowed) {
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
  return displayName(message.from, "there");
}


function buildInstructions(askerName: string): string {
  return [
    "You are the RFPmanager team bot inside a Telegram group. The team brainstorms about government tenders with you.",
    `You are answering ${askerName}. Address them by name and keep the tone collegial and concise.`,
    "Format for a phone chat: short paragraphs, **bold** for tender names and key facts, '- ' bullet lists, [text](https://...) links. No tables and no headings.",
    "You can only see CONVERTED documents (Markdown extracted from the tender files) through your tools - never raw files. If the converted text does not cover a question, say so plainly instead of guessing.",
    "Use the tools to look up RFPs and read documents before answering factual questions about tenders. Never invent tender details, dates, or requirements.",
    "Web search is unrestricted: use it for anything a member asks about - tender context, agencies, market info, tech, or general knowledge. General questions that need no RFP data are welcome; just answer them (search first when facts could be stale).",
    "When someone asks you to write or save a summary for an RFP, draft it from the converted documents and call draft_rfp_summary. The team saves it with the button under it - never claim it is saved.",
    "HTC Global is our company. For questions about HTC itself (capabilities, case studies, references, certifications, insurance, methodology, ABN, address) or whether HTC fits a tender, read the relevant section with read_company_profile - only the sections you need, and not for questions that don't involve HTC. If you quote insurance or other dated details, say when they expire and flag any that have already expired.",
    "Earlier messages from this conversation may come before the new question. Use them to resolve follow-ups like 'that tender' or 'the second one', but answer only the newest question.",
    "You are read-only apart from drafting summaries: you cannot create, edit, or delete RFPs, documents, or drafts. Decline such requests briefly.",
    "If a question is ambiguous about which RFP it means, ask a short clarifying question naming the candidates.",
  ].join("\n");
}

/** Answer one question that was already confirmed as addressed to the bot. */
export async function answerQuestion(
  message: TelegramMessage,
  question: string,
  {
    history = [],
    signal,
    turn = { rfpIds: new Set(), draft: null },
    onStatus,
  }: { history?: HistoryItem[]; signal?: AbortSignal; turn?: Turn; onStatus?: (status: string) => void } = {},
): Promise<string> {
  const asker = senderDisplayName(message);

  return runResponsesTurn({
    instructions: buildInstructions(asker),
    history,
    input: `${asker} asks: ${question}`,
    tools,
    onFunctionCall: (name, args) => {
      const status = TOOL_STATUS.get(name);
      if (status) onStatus?.(status);
      return handleToolCall(name, args, turn);
    },
    signal,
  });
}

const MORE_DETAIL = "more";
const MORE_DETAIL_QUESTION = "Go into more detail on your previous answer.";

/** "More detail" on every answer, plus "Open in RFPmanager" when the answer was about exactly one tender. */
function answerButtons(turn: Turn): InlineKeyboard {
  const row: InlineButton[] = [{ text: "🔍 More detail", callback_data: MORE_DETAIL }];
  const [onlyRfp, ...others] = turn.rfpIds;
  const url = onlyRfp && others.length === 0 ? rfpPageUrl(onlyRfp) : null;
  if (url) row.push({ text: "📂 Open in RFPmanager", url });
  return [row];
}

/** Plain text on purpose: Save stores the message text exactly as shown. */
function draftMessage(draft: SummaryDraft): OutgoingText {
  const label = draft.replacesExisting ? "💾 Save (replaces current summary)" : "💾 Save as summary";
  return { text: draft.summary, buttons: [[{ text: label, callback_data: `save:${draft.rfpId}` }]] };
}

function recall(message: TelegramMessage, botId: number): Promise<Memory | undefined> {
  // Memory is best effort: a missing table or failed query means answering without it.
  return loadMemory(message, botId).catch((error: unknown) => {
    console.warn("Telegram bot answering without memory:", error);
    return undefined;
  });
}

/**
 * Answer in the chat: a "Looking into it…" message straight away that tracks progress and then becomes the
 * answer, buttons under it, any summary draft below, and the exchange remembered for follow-ups. The apology
 * replaces the placeholder only when producing the answer failed.
 */
async function answerInChat({
  message,
  question,
  botId,
  deadlineMs,
  memory,
}: {
  message: TelegramMessage;
  question: string;
  botId: number;
  deadlineMs: number;
  memory: Promise<Memory | undefined>;
}): Promise<void> {
  const progress = startProgress(message.chat.id, message.message_id);
  const turn: Turn = { rfpIds: new Set(), draft: null };

  let reply: string;
  let answered = false;
  try {
    const recalled = await memory;
    reply = await answerQuestion(message, question, {
      history: recalled ? memoryToInput(recalled) : [],
      signal: AbortSignal.timeout(deadlineMs),
      turn,
      onStatus: progress.status,
    });
    answered = true;
  } catch (error) {
    console.error("Telegram bot failed to answer:", error);
    reply =
      error instanceof Error && error.name === "TimeoutError"
        ? "Sorry, that took too long to work out. Try a narrower question (one tender or one document at a time)."
        : "Sorry, something went wrong on my side. Please try again in a moment.";
  }

  const parts = toParts(reply);
  if (answered) {
    const last = parts.length - 1;
    parts[last] = { ...parts[last], buttons: answerButtons(turn) };
    if (turn.draft) parts.push(draftMessage(turn.draft));
  }

  const botMessageIds = await progress.finish(parts);
  if (!answered) return;

  await rememberExchange({ message, botId, question, answer: reply, botMessageIds }).catch((error: unknown) =>
    console.warn("Telegram bot could not remember this exchange:", error),
  );
}

/** Handle one incoming message end to end. Nothing is sent unless the message is addressed to the bot. */
export async function handleTelegramMessage(message: TelegramMessage, { deadlineMs }: { deadlineMs: number }): Promise<void> {
  const botUser = await getBotUser();
  const engagement = engagementFor(message, { id: botUser.id, username: botUser.username ?? "" });
  if (!engagement.respond) return;

  // Memory doesn't depend on the access check, so start loading it now.
  const memory = engagement.kind === "question" ? recall(message, botUser.id) : Promise.resolve(undefined);

  const allowed = allowedChatIds();
  const access = await chatAccess({ chat: message.chat, userId: message.from?.id }, allowed);
  if (access !== "allowed") {
    console.warn("Telegram bot refused chat:", { chatId: message.chat.id, access, allowedCount: allowed.size });
    await sendTelegramMessage(message.chat.id, message.message_id, accessDeniedReply(access, message, allowed.size));
    return;
  }

  switch (engagement.kind) {
    case "help":
      await sendTelegramMessage(message.chat.id, message.message_id, HELP_TEXT);
      return;

    case "clear": {
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

    case "digest":
      await sendTelegramMessage(message.chat.id, message.message_id, buildDigest(await listRfpDigest(), sydneyNow()));
      return;

    case "question":
      await answerInChat({ message, question: engagement.question, botId: botUser.id, deadlineMs, memory });
      return;

    default: {
      const _exhaustive: never = engagement;
      return _exhaustive;
    }
  }
}

export type CallbackAction = { kind: "more" } | { kind: "save"; rfpId: string } | { kind: "ignore" };

/** Button payloads the bot itself put on its messages; anything else is ignored. */
export function parseCallbackData(data: string | undefined): CallbackAction {
  if (data === MORE_DETAIL) return { kind: "more" };
  const save = data?.match(/^save:([0-9a-f-]{36})$/i);
  if (save) return { kind: "save", rfpId: save[1] };
  return { kind: "ignore" };
}

function withoutCallback(keyboard: InlineKeyboard | undefined, data: string): InlineKeyboard {
  return (keyboard ?? [])
    .map((row) => row.filter((button) => !("callback_data" in button && button.callback_data === data)))
    .filter((row) => row.length > 0);
}

/** A tap on one of the bot's buttons: same access rules as messages, answered within Telegram's ~15s window. */
export async function handleTelegramCallback(query: TelegramCallbackQuery, { deadlineMs }: { deadlineMs: number }): Promise<void> {
  const source = query.message;
  if (!source) {
    await answerCallbackQuery(query.id, "That message is too old - please ask me again.");
    return;
  }

  if ((await chatAccess({ chat: source.chat, userId: query.from.id }, allowedChatIds())) !== "allowed") {
    await answerCallbackQuery(query.id, "Sorry, I only answer members of the team's RFPmanager group.");
    return;
  }

  const action = parseCallbackData(query.data);
  switch (action.kind) {
    case "more": {
      const [botUser] = await Promise.all([
        getBotUser(),
        answerCallbackQuery(query.id),
        // Drop the button so a second tap doesn't ask the same thing again.
        editButtons(source.chat.id, source.message_id, withoutCallback(source.reply_markup?.inline_keyboard, MORE_DETAIL)).catch(
          () => undefined,
        ),
      ]);

      // A follow-up "asked" by whoever tapped, replying to the answer, so it joins that answer's thread.
      const followUp: TelegramMessage = {
        message_id: source.message_id,
        chat: source.chat,
        from: query.from,
        text: MORE_DETAIL_QUESTION,
        reply_to_message: source,
      };
      await answerInChat({ message: followUp, question: MORE_DETAIL_QUESTION, botId: botUser.id, deadlineMs, memory: recall(followUp, botUser.id) });
      return;
    }

    case "save": {
      const summary = source.text?.trim();
      if (!summary) {
        await answerCallbackQuery(query.id, "There's no summary text in that message to save.");
        return;
      }
      try {
        await updateRfpSummary(action.rfpId, summary);
      } catch (error) {
        console.error("Telegram bot could not save a summary:", error);
        await answerCallbackQuery(query.id, "Sorry, I couldn't save that. Please try again.");
        return;
      }

      const label = `✅ Saved by ${displayName(query.from, "a team member")}`;
      const url = rfpPageUrl(action.rfpId);
      await Promise.all([
        answerCallbackQuery(query.id, "Saved to RFPmanager."),
        editButtons(source.chat.id, source.message_id, [[url ? { text: `${label} - open`, url } : { text: label, callback_data: "saved" }]]).catch(
          () => undefined,
        ),
      ]);
      return;
    }

    case "ignore":
      await answerCallbackQuery(query.id);
      return;

    default: {
      const _exhaustive: never = action;
      return _exhaustive;
    }
  }
}
