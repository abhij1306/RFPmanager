import { cleanConvertedMarkdown } from "@/lib/document-markdown-cleanup";
import { getAllowedFileSourceType, type ConversionResult } from "@/lib/document-conversion-core";

export async function convertBufferToMarkdown({
  buffer,
  filename,
}: {
  buffer: ArrayBuffer;
  filename: string;
}): Promise<ConversionResult> {
  const sourceType = getAllowedFileSourceType(filename);

  if (sourceType === "markdown") {
    return { markdown: cleanConvertedMarkdown(new TextDecoder().decode(buffer)), sourceType };
  }

  const { toMarkdownBytes } = await import("@firecrawl/anydoc");
  // AnyDoc's generated Node types use a const enum although its documented API accepts "csv".
  const csvFormat = "csv" as import("@firecrawl/anydoc").Format;
  const markdown = await toMarkdownBytes(
    new Uint8Array(buffer),
    sourceType === "csv" ? csvFormat : undefined,
    { ocr: "reject" },
  );
  return { markdown: markdown.trim(), sourceType };
}
