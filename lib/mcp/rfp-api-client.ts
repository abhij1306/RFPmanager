export type RfpApiClientFetch = typeof fetch;

export class RfpApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "RfpApiError";
  }
}

export type RfpApiClientOptions = {
  baseUrl: string;
  apiKey: string;
  fetchImpl?: RfpApiClientFetch;
};

export class RfpApiClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly fetchImpl: RfpApiClientFetch;

  constructor({ baseUrl, apiKey, fetchImpl = fetch }: RfpApiClientOptions) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.apiKey = apiKey;
    this.fetchImpl = fetchImpl;
  }

  async request<T>(
    path: string,
    options: { method?: "GET" | "POST" | "PATCH"; query?: Record<string, string | number | undefined>; body?: unknown } = {},
  ): Promise<T> {
    const url = new URL(`${this.baseUrl}${path}`);

    for (const [key, value] of Object.entries(options.query ?? {})) {
      if (value !== undefined) {
        url.searchParams.set(key, String(value));
      }
    }

    const response = await this.fetchImpl(url, {
      method: options.method ?? "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${this.apiKey}`,
        ...(options.body === undefined ? {} : { "Content-Type": "application/json" }),
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });

    const raw = await response.text();
    let payload: unknown = null;

    if (raw) {
      try {
        payload = JSON.parse(raw);
      } catch {
        payload = null;
      }
    }

    if (!response.ok) {
      const message =
        payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string"
          ? payload.error
          : `RFPmanager request failed with status ${response.status}.`;
      throw new RfpApiError(response.status, message);
    }

    return payload as T;
  }
}

export function createRfpApiClient(fetchImpl?: RfpApiClientFetch): RfpApiClient {
  const baseUrl = process.env.RFPMANAGER_API_BASE_URL;
  const apiKey = process.env.CHATGPT_ACTIONS_API_KEY;

  if (!baseUrl) {
    throw new Error("Missing RFPMANAGER_API_BASE_URL environment variable.");
  }

  if (!apiKey) {
    throw new Error("Missing CHATGPT_ACTIONS_API_KEY environment variable.");
  }

  return new RfpApiClient({ baseUrl, apiKey, fetchImpl });
}
