import { describe, expect, it } from "vitest";
import { getErrorMessage, toError } from "@/lib/errors";

describe("getErrorMessage", () => {
  it("reads Supabase-style plain object errors", () => {
    expect(getErrorMessage({ message: "Database request failed" }, "Fallback")).toBe("Database request failed");
  });

  it("uses the fallback for values without a useful message", () => {
    expect(getErrorMessage({ message: "  " }, "Fallback")).toBe("Fallback");
  });

  it("normalizes plain object failures at data boundaries", () => {
    const original = { code: "42501", message: "Row-level security denied the request" };
    const normalized = toError(original, "Fallback");

    expect(normalized).toBeInstanceOf(Error);
    expect(normalized.message).toBe(original.message);
    expect(normalized.cause).toBe(original);
  });
});
