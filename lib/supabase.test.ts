import { afterEach, describe, expect, it, vi } from "vitest";

const createClientMock = vi.fn(() => ({ from: vi.fn() }));

vi.mock("@supabase/supabase-js", () => ({
  createClient: createClientMock,
}));

describe("getSupabase", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
    createClientMock.mockClear();
  });

  it("reuses one Supabase client instance", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-key");

    const { getSupabase } = await import("@/lib/supabase");

    const first = getSupabase();
    const second = getSupabase();

    expect(second).toBe(first);
    expect(createClientMock).toHaveBeenCalledTimes(1);
  });
});
