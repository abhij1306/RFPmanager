import { describe, expect, it } from "vitest";
import { closingDateState, daysUntil, formatDateOnly, isClosingSoon, parseTenderDate } from "@/lib/date";

const today = new Date("2026-06-03T10:00:00");

describe("RFP closing date helpers", () => {
  it("returns null when no date is available", () => {
    expect(daysUntil(null, today)).toBeNull();
  });

  it("marks a date before today as overdue", () => {
    expect(closingDateState("2026-06-02", today)).toBe("overdue");
  });

  it("marks dates within seven days as closing soon", () => {
    expect(closingDateState("2026-06-10", today)).toBe("soon");
    expect(isClosingSoon("2026-06-10", today)).toBe(true);
  });

  it("does not mark future dates after seven days as closing soon", () => {
    expect(closingDateState("2026-06-11", today)).toBe("normal");
    expect(isClosingSoon("2026-06-11", today)).toBe(false);
  });

  it("does not silently normalize an invalid calendar date", () => {
    expect(formatDateOnly("2026-02-30")).toBe("2026-02-30");
    expect(formatDateOnly("2026-13-01")).toBe("2026-13-01");
    expect(formatDateOnly("2026-02-28")).toBe("Feb 28, 2026");
  });

  it("parses named dates without inventing a timezone or guessing ambiguous numeric dates", () => {
    expect(parseTenderDate("30 September 2026, 2:00 PM AEST")).toBe("2026-09-30");
    expect(parseTenderDate("September 30, 2026")).toBe("2026-09-30");
    expect(parseTenderDate("31/08/2026")).toBe("2026-08-31");
    expect(parseTenderDate("08/09/2026")).toBeNull();
    expect(parseTenderDate("31 February 2026")).toBeNull();
    expect(parseTenderDate("2026-09-30T14:00:00+10:00")).toBe("2026-09-30");
    expect(parseTenderDate("2026-02-31T14:00:00+10:00")).toBeNull();
  });
});
