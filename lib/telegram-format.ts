/**
 * Light Markdown (what the model writes) to Telegram's HTML parse mode. Only constructs that read well on a
 * phone are converted - **bold**, `code`, [links](https://...), "- " bullets and "#" headings (as bold lines);
 * everything else is escaped and shown as typed. Each line is converted on its own, so splitting a long
 * answer on line boundaries never leaves a tag open.
 */

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function convertInline(line: string): string {
  // Code spans first, so nothing inside them is formatted.
  return line
    .split(/(`[^`\n]+`)/)
    .map((part) => {
      if (/^`[^`\n]+`$/.test(part)) return `<code>${escapeHtml(part.slice(1, -1))}</code>`;
      return escapeHtml(part)
        .replace(/\[([^\]\n]+)\]\((https?:\/\/[^)\s]+)\)/g, (_match, label: string, url: string) => {
          return `<a href="${url.replace(/"/g, "&quot;")}">${label}</a>`;
        })
        .replace(/\*\*([^*\n]+)\*\*/g, "<b>$1</b>");
    })
    .join("");
}

export function markdownToTelegramHtml(markdown: string): string {
  return markdown
    .split("\n")
    .map((line) => {
      const heading = line.match(/^\s{0,3}#{1,6}\s+(.+?)\s*#*\s*$/);
      if (heading) return `<b>${convertInline(heading[1].replace(/\*\*/g, ""))}</b>`;

      const bullet = line.match(/^(\s*)[-*•]\s+(.*)$/);
      if (bullet) return `${bullet[1]}• ${convertInline(bullet[2])}`;

      return convertInline(line);
    })
    .join("\n");
}
