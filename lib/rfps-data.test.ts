import { beforeEach, describe, expect, it, vi } from "vitest";

const { getSupabaseMock } = vi.hoisted(() => ({ getSupabaseMock: vi.fn() }));

vi.mock("@/lib/supabase", () => ({ getSupabase: getSupabaseMock }));

import { listTrackerRfps } from "@/lib/rfps";

function orderedQuery(result: { data: Array<Record<string, unknown>> | null; error: unknown }) {
  return {
    select: vi.fn(() => ({
      order: vi.fn(() => ({
        order: vi.fn().mockResolvedValue(result),
      })),
    })),
  };
}

describe("RFP database reads", () => {
  beforeEach(() => vi.clearAllMocks());

  it("does not hide operational failures behind a legacy-schema retry", async () => {
    const from = vi.fn(() => orderedQuery({ data: null, error: { code: "42501", message: "Permission denied" } }));
    getSupabaseMock.mockReturnValue({ from });

    await expect(listTrackerRfps()).rejects.toThrow("Permission denied");
    expect(from).toHaveBeenCalledTimes(1);
  });

  it("retains the legacy fallback for a missing-column response", async () => {
    const from = vi
      .fn()
      .mockReturnValueOnce(orderedQuery({ data: null, error: { code: "42703", message: "Column missing" } }))
      .mockReturnValueOnce(
        orderedQuery({
          data: [
            {
              id: "rfp-1",
              client_name: "Legacy client",
              status: "TBD",
              pipeline_stage: "Prospects",
              created_at: "2026-08-10T00:00:00.000Z",
            },
          ],
          error: null,
        }),
      );
    getSupabaseMock.mockReturnValue({ from });

    await expect(listTrackerRfps()).resolves.toEqual([
      expect.objectContaining({ id: "rfp-1", client_name: "Legacy client", document_links: [] }),
    ]);
    expect(from).toHaveBeenCalledTimes(2);
  });
});
