import init, { toMarkdownBytes } from "./anydoc_wasm.js";

let initialization;

self.onmessage = async ({ data }) => {
  const { id, bytes, format } = data;

  try {
    initialization ??= init({ module_or_path: "/anydoc/anydoc_wasm_bg.wasm" }).catch((error) => {
      initialization = undefined;
      throw error;
    });
    await initialization;
    const markdown = toMarkdownBytes(bytes, format).trim();
    self.postMessage({ id, markdown });
  } catch (error) {
    self.postMessage({ id, error: error instanceof Error ? error.message : String(error) });
  }
};
