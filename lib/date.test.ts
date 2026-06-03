import { describe, expect, it } from "vitest";
import { closingDateState, daysUntil, isClosingSoon } from "@/lib/date";

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
});
