import { cleanConvertedMarkdown } from "@/lib/document-markdown-cleanup";
import { getAllowedFileSourceType, type ConversionResult } from "@/lib/document-conversion-core";

type PendingConversion = {
  resolve: (markdown: string) => void;
  reject: (error: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
};

const CONVERSION_TIMEOUT_MS = 120_000;
let worker: Worker | null = null;
let nextRequestId = 0;
const pendingConversions = new Map<number, PendingConversion>();

function failPendingConversions(error: Error) {
  for (const pending of pendingConversions.values()) {
    clearTimeout(pending.timeout);
    pending.reject(error);
  }
  pendingConversions.clear();
  worker?.terminate();
  worker = null;
}

function getConversionWorker(): Worker {
  if (worker) return worker;

  const conversionWorker = new Worker("/anydoc/worker.js", { type: "module" });
  worker = conversionWorker;
  conversionWorker.onmessage = (event: MessageEvent<{ id: number; markdown?: string; error?: string }>) => {
    const { id, markdown, error } = event.data;
    const pending = pendingConversions.get(id);
    if (!pending) return;
    pendingConversions.delete(id);
    clearTimeout(pending.timeout);

    if (error) pending.reject(new Error(error));
    else if (typeof markdown === "string") pending.resolve(markdown.trim());
    else pending.reject(new Error("The document converter returned no text."));
  };
  conversionWorker.onerror = () => {
    if (worker === conversionWorker) failPendingConversions(new Error("The document converter stopped unexpectedly."));
  };
  conversionWorker.onmessageerror = () => {
    if (worker === conversionWorker) failPendingConversions(new Error("The document converter could not read the file."));
  };
  return conversionWorker;
}

async function convertWithAnydoc(file: File, sourceType: Exclude<ConversionResult["sourceType"], "markdown">): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());

  return new Promise((resolve, reject) => {
    const id = ++nextRequestId;
    const timeout = setTimeout(() => {
      if (pendingConversions.has(id)) {
        failPendingConversions(new Error("Document conversion timed out. Please try again."));
      }
    }, CONVERSION_TIMEOUT_MS);
    pendingConversions.set(id, { resolve, reject, timeout });

    try {
      getConversionWorker().postMessage({ id, bytes, format: sourceType === "csv" ? "csv" : undefined }, [bytes.buffer]);
    } catch (error) {
      pendingConversions.delete(id);
      clearTimeout(timeout);
      reject(error);
    }
  });
}

export async function convertFile(file: File): Promise<ConversionResult> {
  const sourceType = getAllowedFileSourceType(file.name);

  if (sourceType === "markdown") {
    return { markdown: cleanConvertedMarkdown(await file.text()), sourceType };
  }

  return { markdown: await convertWithAnydoc(file, sourceType), sourceType };
}

export { getAllowedFileSourceType, type ConversionResult } from "@/lib/document-conversion-core";
