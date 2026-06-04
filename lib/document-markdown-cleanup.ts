const DATA_IMAGE_MARKDOWN_PATTERN = /!\[[^\]]*]\(\s*data:image\/[^)\s]+(?:\s+"[^"]*")?\s*\)/gi;
const MARKDOWN_IMAGE_PATTERN = /!\[[^\]]*]\([^)]*\)/g;
const HTML_IMAGE_PATTERN = /<img\b[^>]*>/gi;
const DATA_IMAGE_TEXT_PATTERN = /data:image\/[a-z0-9.+-]+;base64,[a-z0-9+/=\s]+/gi;
const BASE64_NOISE_LINE_PATTERN = /^[a-z0-9+/=\s]{240,}$/i;

function collapseBlankLines(markdown: string): string {
  return markdown
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter((line) => !BASE64_NOISE_LINE_PATTERN.test(line.trim()))
    .join("\n")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function removeHtmlImages(html: string): string {
  return html.replace(HTML_IMAGE_PATTERN, "");
}

export function cleanConvertedMarkdown(markdown: string): string {
  return collapseBlankLines(
    markdown
      .replace(DATA_IMAGE_MARKDOWN_PATTERN, "")
      .replace(MARKDOWN_IMAGE_PATTERN, "")
      .replace(DATA_IMAGE_TEXT_PATTERN, ""),
  );
}
