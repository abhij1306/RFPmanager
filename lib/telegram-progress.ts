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
 * Posting it doesn't hold up the answer. Status edits run one at a time and only the latest waiting status is
 * shown; once finish() is called no further status is shown, so a late one can never overwrite the answer.
 * If the placeholder can't be posted or edited, the answer is simply sent as new messages.
 */
export function startProgress(chatId: number, replyToMessageId: number): ProgressMessage {
  const placeholder = sendText(chatId, replyToMessageId, { text: PLACEHOLDER }).catch(() => null);
  let edits: Promise<void> = Promise.resolve();
  let waitingStatus: string | null = null;
  let shown = PLACEHOLDER;
  let finished = false;

  const showWaitingStatus = async () => {
    const text = waitingStatus;
    waitingStatus = null;
    const placeholderId = await placeholder;
    if (text === null || finished || placeholderId === null) return;
    await editText(chatId, placeholderId, { text }).catch(() => undefined);
  };

  return {
    status(text) {
      const next = `🔎 ${text}`;
      if (finished || next === shown) return;
      shown = next;
      waitingStatus = next;
      edits = edits.then(showWaitingStatus);
    },

    async finish([first, ...rest]) {
      finished = true;
      await edits;
      const placeholderId = await placeholder;

      const ids: number[] = [];
      let unsent = [first, ...rest];
      if (placeholderId !== null) {
        try {
          await editText(chatId, placeholderId, first);
          ids.push(placeholderId);
          unsent = rest;
        } catch {
          // Placeholder gone (deleted, too old): send the whole answer fresh.
        }
      }

      for (const part of unsent) ids.push(await sendText(chatId, replyToMessageId, part));
      return ids;
    },
  };
}
