import { describe, expect, it } from "vitest";
import { closingInfo, displayTitle, formatBytes } from "@/lib/display";

describe("displayTitle", () => {
  it("strips the issuer and portal page suffix from scraped names", () => {
    expect(displayTitle("Library system replacement - Issued by City Council")).toBe("Library system replacement");
    expect(displayTitle("Hume City Council | 30 26 3733 | Opportunity Details")).toBe("Hume City Council | 30 26 3733");
  });
});

describe("closingInfo", () => {
  const now = new Date(2026, 9, 10);

  it("labels dates relative to today", () => {
    expect(closingInfo("2026-10-13", null, now)).toEqual({ kind: "date", label: "Oct 13, 2026", relative: "In 3 days", urgency: "soon" });
    expect(closingInfo("2026-10-01", null, now)).toEqual({ kind: "date", label: "Oct 1, 2026", relative: "Closed", urgency: "past" });
    expect(closingInfo("2026-11-30", null, now)).toMatchObject({ relative: "In 51 days", urgency: "later" });
  });

  it("falls back to the written deadline when no date was parsed", () => {
    expect(closingInfo(null, "Closing 2pm AEST, late October", now)).toEqual({ kind: "text", label: "Closing 2pm AEST, late October" });
    expect(closingInfo(null, null, now)).toEqual({ kind: "none" });
  });
});

describe("formatBytes", () => {
  it("formats file sizes", () => {
    expect(formatBytes(2_621_440)).toBe("2.5 MB");
    expect(formatBytes(51_200)).toBe("50 KB");
    expect(formatBytes(null)).toBeNull();
  });
});
