import { describe, expect, it } from "vitest";
import { markdownToTelegramHtml } from "@/lib/telegram-format";

describe("markdownToTelegramHtml", () => {
  it("converts bold, links, bullets and headings and escapes everything else", () => {
    const markdown = [
      "## Closing soon",
      "- **Bathurst** closes 20 Oct, see [the tender](https://tenders.example/b?x=1&y=2)",
      "Budget < $50k & scope > 3 sites",
    ].join("\n");

    expect(markdownToTelegramHtml(markdown)).toBe(
      [
        "<b>Closing soon</b>",
        '• <b>Bathurst</b> closes 20 Oct, see <a href="https://tenders.example/b?x=1&amp;y=2">the tender</a>',
        "Budget &lt; $50k &amp; scope &gt; 3 sites",
      ].join("\n"),
    );
  });

  it("leaves code spans unformatted and drops unsafe link schemes", () => {
    expect(markdownToTelegramHtml("run `a **b** <c>` then [x](javascript:alert(1))")).toBe(
      "run <code>a **b** &lt;c&gt;</code> then [x](javascript:alert(1))",
    );
  });
});
