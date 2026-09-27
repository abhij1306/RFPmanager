import { copyFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const packageEntry = fileURLToPath(import.meta.resolve("@firecrawl/anydoc-wasm"));
const packageDirectory = dirname(packageEntry);
const outputDirectory = fileURLToPath(new URL("../public/anydoc/", import.meta.url));

await mkdir(outputDirectory, { recursive: true });
await Promise.all(
  ["anydoc_wasm.js", "anydoc_wasm_bg.wasm"].map((filename) =>
    copyFile(join(packageDirectory, filename), join(outputDirectory, filename)),
  ),
);
