import { describe, expect, it } from "vitest";
import { readCompanyProfile, readProfileSections, splitProfileSections } from "@/lib/company-profile";

const sample = ["> notes", "", "# 1  Overview", "About us.", "## 1.1  Snapshot", "ABN 1", "# 2  Insurance", "PI cover."].join("\n");

describe("company profile sections", () => {
  it("splits on top-level headings and keeps subsections inside", () => {
    expect(splitProfileSections(sample)).toEqual([
      { title: "Document notes", body: "> notes" },
      { title: "1 Overview", body: "About us.\n## 1.1  Snapshot\nABN 1" },
      { title: "2 Insurance", body: "PI cover." },
    ]);
  });

  it("reads a section by number or title and lists sections otherwise", () => {
    const sections = splitProfileSections(sample);

    expect(readProfileSections(sections, "insur")).toBe("# 2 Insurance\n\nPI cover.");
    expect(readProfileSections(sections, "2")).toBe("# 2 Insurance\n\nPI cover.");
    expect(readProfileSections(sections, "pricing")).toBe(
      'No section title matches "pricing". Company profile sections - call again with one of these titles:\n- Document notes (7 chars)\n- 1 Overview (32 chars)\n- 2 Insurance (9 chars)',
    );
  });

  it("serves the real profile with the new head office address", async () => {
    expect(await readCompanyProfile("Company Overview")).toContain("| Head Office | Unit 406, 7 Maitland Place, Norwest, NSW 2153, Australia |");
  });

  it("treats a section number as exact, so 1 does not also return section 10", async () => {
    const overview = await readCompanyProfile("1");

    expect(overview.startsWith("# 1 Company Overview")).toBe(true);
    expect(overview).not.toContain("# 10 Insurance & Risk Coverage");
    expect((await readCompanyProfile("10")).startsWith("# 10 Insurance & Risk Coverage")).toBe(true);
  });
});
