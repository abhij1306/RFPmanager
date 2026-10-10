import { beforeEach, describe, expect, it, vi } from "vitest";
import { createRfpFileDownloadUrlBatch, listSourceFileCountsByRfp } from "@/lib/rfp-files";
import { buildRfpSearchFilter } from "@/lib/rfps";
import { getSupabase } from "@/lib/supabase";
import type { RfpFile } from "@/lib/types";

vi.mock("@/lib/supabase", () => ({ getSupabase: vi.fn() }));
const getSupabaseMock = vi.mocked(getSupabase);

describe("buildRfpSearchFilter", () => {
  it("escapes LIKE wildcards and PostgREST delimiters", () => {
    expect(buildRfpSearchFilter('50%_a\\b, (c) "d"')).toBe(
      [
        "client_name",
        "tender_code",
        "description",
        "notes",
        "tender_link",
        "pipeline_stage",
        "status",
      ]
        .map((column) => `${column}.ilike."%50\\\\%\\\\_a\\\\\\\\b, (c) \\"d\\"%"`)
        .join(","),
    );
  });

  it("declines terms containing *, which PostgREST always treats as a wildcard", () => {
    expect(buildRfpSearchFilter("a*b")).toBeNull();
    expect(buildRfpSearchFilter("ab")).toContain('client_name.ilike."%ab%"');
  });
});

describe("listSourceFileCountsByRfp", () => {
  beforeEach(() => vi.resetAllMocks());

  it("uses the RPC when installed and falls back to counting rows when it is missing", async () => {
    const rpc = vi
      .fn()
      .mockResolvedValueOnce({ data: [{ rfp_id: "rfp-1", count: "2" }], error: null })
      .mockResolvedValueOnce({ data: null, error: { code: "PGRST202", message: "not found" } });
    const eq = vi.fn().mockResolvedValue({ data: [{ rfp_id: "a" }, { rfp_id: "a" }, { rfp_id: "b" }], error: null });
    getSupabaseMock.mockReturnValue({ rpc, from: () => ({ select: () => ({ eq }) }) } as never);

    await expect(listSourceFileCountsByRfp()).resolves.toEqual([{ rfp_id: "rfp-1", count: 2 }]);
    await expect(listSourceFileCountsByRfp()).resolves.toEqual([
      { rfp_id: "a", count: 2 },
      { rfp_id: "b", count: 1 },
    ]);
    // The miss is remembered, so the next call skips the failing RPC round trip.
    await expect(listSourceFileCountsByRfp()).resolves.toEqual([
      { rfp_id: "a", count: 2 },
      { rfp_id: "b", count: 1 },
    ]);
    expect(rpc).toHaveBeenCalledTimes(2);
  });
});

describe("createRfpFileDownloadUrlBatch", () => {
  beforeEach(() => vi.resetAllMocks());

  const file = (id: string, original: string): RfpFile => ({
    id,
    rfp_id: "rfp-1",
    kind: "source",
    title: id,
    original_filename: original,
    mime_type: null,
    storage_path: `rfp-1/source/${id}.pdf`,
    file_size_bytes: null,
    status: null,
    notes: null,
    created_by: "Team",
    created_at: "2026-06-01T00:00:00+00:00",
  });

  it("signs all files in one call and appends the download name like createSignedUrl does", async () => {
    const createSignedUrls = vi.fn().mockResolvedValue({
      data: [
        { path: "rfp-1/source/a.pdf", signedUrl: "https://s.test/sign/rfp-1/source/a.pdf?token=t1", error: null },
        { path: "rfp-1/source/b.pdf", signedUrl: null, error: "Object not found" },
      ],
      error: null,
    });
    const createSignedUrl = vi.fn().mockResolvedValue({ data: { signedUrl: "https://s.test/single-b" }, error: null });
    getSupabaseMock.mockReturnValue({ storage: { from: () => ({ createSignedUrls, createSignedUrl }) } } as never);

    const files = [file("a", "Tender spec (v2) & notes.pdf"), file("b", "b.pdf")];
    const resolve = await createRfpFileDownloadUrlBatch(files);

    await expect(resolve(files[0])).resolves.toBe(
      "https://s.test/sign/rfp-1/source/a.pdf?token=t1&download=Tender+spec+%2528v2%2529+%2526+notes.pdf",
    );
    await expect(resolve(files[1])).resolves.toBe("https://s.test/single-b");
    expect(createSignedUrls).toHaveBeenCalledWith(["rfp-1/source/a.pdf", "rfp-1/source/b.pdf"], 600);
  });
});
