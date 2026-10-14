import { readFile } from "node:fs/promises";
import path from "node:path";
import { memoizeAsync } from "@/lib/memoize-async";

/**
 * HTC Global's company profile (docs/htc-knowledge-base.md), served to the Telegram bot section by section
 * and only when a question needs it - it is never added to every prompt. next.config.mjs traces the file
 * into the /api/telegram function bundle.
 */

const PROFILE_PATH = path.join(process.cwd(), "docs", "htc-knowledge-base.md");

export type ProfileSection = { title: string; body: string };

/** Split on top-level "# " headings; text before the first one becomes the "Document notes" section. */
export function splitProfileSections(markdown: string): ProfileSection[] {
  const sections: ProfileSection[] = [];
  let current: ProfileSection = { title: "Document notes", body: "" };

  for (const line of markdown.split(/\r?\n/)) {
    const heading = line.match(/^# (?!#)(.+)$/);
    if (heading) {
      if (current.body.trim()) sections.push({ title: current.title, body: current.body.trim() });
      current = { title: heading[1].replace(/\s+/g, " ").trim(), body: "" };
      continue;
    }
    current.body += `${line}\n`;
  }

  if (current.body.trim()) sections.push({ title: current.title, body: current.body.trim() });
  return sections;
}

/**
 * No query: the section list (titles and sizes) so the model can pick. With a query: every section whose
 * title contains it (case-insensitive, e.g. "case stud"), or whose number is exactly it (e.g. "8"), or the list again when none match.
 */
export function readProfileSections(sections: ProfileSection[], query: string | undefined): string {
  const needle = query?.trim().toLowerCase();
  // A bare number names a section exactly, so "1" is not also "10 Insurance & Risk Coverage".
  const matches = !needle
    ? []
    : /^\d+$/.test(needle)
      ? sections.filter((section) => section.title.startsWith(`${needle} `))
      : sections.filter((section) => section.title.toLowerCase().includes(needle));

  if (matches.length === 0) {
    const list = sections.map((section) => `- ${section.title} (${section.body.length} chars)`).join("\n");
    const prefix = needle ? `No section title matches "${query}". ` : "";
    return `${prefix}Company profile sections - call again with one of these titles:\n${list}`;
  }

  return matches.map((section) => `# ${section.title}\n\n${section.body}`).join("\n\n");
}

const loadSections = memoizeAsync(() => readFile(PROFILE_PATH, "utf8").then(splitProfileSections));

export async function readCompanyProfile(query: string | undefined): Promise<string> {
  return readProfileSections(await loadSections(), query);
}
