import { editText, sendText, type OutgoingText } from "@/lib/telegram";

const PLACEHOLDER = "🔎 Looking into it…";

export type ProgressMessage = {
  /** Show what the bot is doing now ("Reading the tender documents…"). Best effort, never throws. */
  status(text: string): void;
  /** Turn the placeholder into the first part of the answer and send the rest. Resolves to every message id used. */
  finish(parts: [OutgoingText, ...OutgoingText[]]): Promise<number[]>;
};

/**
 * The message a question gets straight away, so the group sees the bot is on it instead of a silent wait.
 * Status edits are queued, and finish() waits for them, so a late status can never overwrite the answer.
 * If the placeholder can't be posted or edited, the answer is simply sent as new messages.
 */
export async function startProgress(chatId: number, replyToMessageId: number): Promise<ProgressMessage> {
  const placeholderId = await sendText(chatId, replyToMessageId, { text: PLACEHOLDER }).catch(() => null);
  let edits: Promise<void> = Promise.resolve();
  let finished = false;
  let shown = PLACEHOLDER;

  return {
    status(text) {
      const next = `🔎 ${text}`;
      if (placeholderId === null || finished || next === shown) return;
      shown = next;
      edits = edits.then(() => editText(chatId, placeholderId, { text: next })).catch(() => undefined);
    },

    async finish([first, ...rest]) {
      finished = true;
      await edits;

      const ids: number[] = [];
      let unsent = [first, ...rest];
      if (placeholderId !== null) {
        const edited = await editText(chatId, placeholderId, first).then(
          () => true,
          () => false,
        );
        if (edited) {
          ids.push(placeholderId);
          unsent = rest;
        }
      }

      for (const part of unsent) ids.push(await sendText(chatId, replyToMessageId, part));
      return ids;
    },
  };
}
