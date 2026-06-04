import type { RfpFile } from "@/lib/types";

export type RfpSourceFileSummary = RfpFile & {
  download_url: string | null;
  download_error?: string;
};

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Could not create download URL.";
}

export async function toSourceFileSummaries(
  files: RfpFile[],
  createDownloadUrl: (file: RfpFile) => Promise<string>,
): Promise<RfpSourceFileSummary[]> {
  return Promise.all(
    files
      .filter((file) => file.kind === "source")
      .map(async (file) => {
        try {
          return {
            ...file,
            download_url: await createDownloadUrl(file),
          };
        } catch (error) {
          return {
            ...file,
            download_url: null,
            download_error: errorMessage(error),
          };
        }
      }),
  );
}
