import { describe, expect, it } from "vitest";
import { cleanConvertedMarkdown } from "@/lib/document-markdown-cleanup";

describe("document markdown cleanup", () => {
  it("removes markdown image links and data image payloads", () => {
    const markdown = [
      "# Tender",
      "",
      "![logo](data:image/png;base64,AAAAABBBBBCCCCCDDDDDEEEEE)",
      "Keep the requirement text.",
      "![diagram](https://example.test/diagram.png)",
      "data:image/jpeg;base64,FFFFFGGGGGHHHHHIIIII",
    ].join("\n");

    expect(cleanConvertedMarkdown(markdown)).toBe("# Tender\n\nKeep the requirement text.");
  });

  it("removes standalone base64 noise lines", () => {
    const noisyLine = "A".repeat(260);
    const markdown = `Useful text\n${noisyLine}\nMore useful text`;

    expect(cleanConvertedMarkdown(markdown)).toBe("Useful text\nMore useful text");
  });
});
