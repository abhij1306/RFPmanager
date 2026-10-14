import { describe, expect, it } from "vitest";
import { buildDigest, sydneyNow } from "@/lib/telegram-digest";
import type { RfpDigestItem } from "@/lib/rfp-queries";

function rfp(overrides: Partial<RfpDigestItem> & Pick<RfpDigestItem, "id" | "client_name">): RfpDigestItem {
  return {
    tender_code: null,
    status: "TBD",
    pipeline_stage: "Active",
    closing_date: null,
    closing_date_text: null,
    summary_generated_at: null,
    document_count: 0,
    ...overrides,
  };
}

const monday = new Date(2026, 9, 19, 9, 0);
const pageUrl = (id: string) => `https://rfp.example/rfp/${id}`;

describe("buildDigest", () => {
  it("lists tenders closing within 14 days, soonest first, linked to their pages", () => {
    const digest = buildDigest(
      [
        rfp({ id: "b", client_name: "Orange Council - Issued by NSW Gov", closing_date: "2026-10-30", status: "Yes" }),
        rfp({ id: "a", client_name: "Bathurst Water", closing_date: "2026-10-20" }),
        rfp({ id: "old", client_name: "Closed One", closing_date: "2026-10-18" }),
        rfp({ id: "far", client_name: "Far Away", closing_date: "2026-11-30" }),
        rfp({ id: "none", client_name: "No Date" }),
      ],
      monday,
      pageUrl,
    );

    expect(digest).toBe(
      [
        "📅 **Tenders closing in the next 14 days**",
        "",
        "- [**Bathurst Water**](https://rfp.example/rfp/a) - Tomorrow (Oct 20, 2026) · bid: TBD · Active",
        "- [**Orange Council**](https://rfp.example/rfp/b) - In 11 days (Oct 30, 2026) · bid: Yes · Active",
      ].join("\n"),
    );
  });

  it("says so when nothing closes soon", () => {
    expect(buildDigest([rfp({ id: "far", client_name: "Far Away", closing_date: "2026-12-30" })], monday, pageUrl)).toBe(
      "📅 **No tenders close in the next 14 days.**",
    );
  });
});

describe("sydneyNow", () => {
  it("gives Sydney's Monday morning when the UTC cron fires on Sunday night", () => {
    const local = sydneyNow(new Date("2026-10-18T22:00:00Z"));

    expect([local.getFullYear(), local.getMonth() + 1, local.getDate(), local.getHours()]).toEqual([2026, 10, 19, 9]);
  });
});
