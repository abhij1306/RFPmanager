import { afterEach, describe, expect, it, vi } from "vitest";

type WorkerMessage = { id: number; bytes: Uint8Array; format?: string };

class ConversionWorkerStub {
  static instances: ConversionWorkerStub[] = [];
  static respond = true;
  onmessage: ((event: MessageEvent<{ id: number; markdown: string }>) => void) | null = null;
  onerror: (() => void) | null = null;
  onmessageerror: (() => void) | null = null;
  messages: WorkerMessage[] = [];
  terminated = false;

  constructor() {
    ConversionWorkerStub.instances.push(this);
  }

  postMessage(message: WorkerMessage) {
    this.messages.push(message);
    if (ConversionWorkerStub.respond) {
      queueMicrotask(() => this.onmessage?.({ data: { id: message.id, markdown: "| Item | Price |" } } as MessageEvent));
    }
  }

  terminate() {
    this.terminated = true;
  }
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.resetModules();
  ConversionWorkerStub.instances = [];
  ConversionWorkerStub.respond = true;
});

describe("browser document conversion", () => {
  it("reuses one worker across automatic conversions and identifies CSV explicitly", async () => {
    vi.stubGlobal("Worker", ConversionWorkerStub);
    const { convertFile } = await import("@/lib/document-conversion");
    const csv = {
      name: "pricing.csv",
      arrayBuffer: async () => new TextEncoder().encode("Item,Price\nSupport,1250").buffer,
    } as File;

    const first = await convertFile(csv);
    const second = await convertFile(csv);

    expect(first).toEqual({ sourceType: "csv", markdown: "| Item | Price |" });
    expect(second).toEqual(first);
    expect(ConversionWorkerStub.instances).toHaveLength(1);
    expect(ConversionWorkerStub.instances[0].messages.map(({ format }) => format)).toEqual(["csv", "csv"]);
  });

  it("times out stalled conversions, clears pending requests, and starts a fresh worker", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("Worker", ConversionWorkerStub);
    ConversionWorkerStub.respond = false;
    const { convertFile } = await import("@/lib/document-conversion");
    const csv = {
      name: "pricing.csv",
      arrayBuffer: async () => new TextEncoder().encode("Item,Price\nSupport,1250").buffer,
    } as File;

    const first = convertFile(csv);
    const second = convertFile(csv);
    const firstResult = expect(first).rejects.toThrow("Document conversion timed out. Please try again.");
    const secondResult = expect(second).rejects.toThrow("Document conversion timed out. Please try again.");

    await vi.advanceTimersByTimeAsync(120_000);
    await Promise.all([firstResult, secondResult]);
    expect(ConversionWorkerStub.instances).toHaveLength(1);
    expect(ConversionWorkerStub.instances[0].terminated).toBe(true);

    ConversionWorkerStub.respond = true;
    await expect(convertFile(csv)).resolves.toMatchObject({ sourceType: "csv" });
    expect(ConversionWorkerStub.instances).toHaveLength(2);
    await vi.advanceTimersByTimeAsync(120_000);
    expect(ConversionWorkerStub.instances[1].terminated).toBe(false);
  });
});
