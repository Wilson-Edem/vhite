import { watch } from "node:fs";
import { resolve } from "node:path";
import { runScan } from "./scan.js";

const IGNORED_SEGMENTS = new Set(["node_modules", ".git", ".vhite-fix", "dist", "build", "coverage"]);
const DEBOUNCE_MS = 300;

function isIgnoredPath(filename) {
  return filename.split(/[\\/]/).some((part) => IGNORED_SEGMENTS.has(part));
}

export async function runWatch(options) {
  const target = resolve(options.path ?? ".");
  const scanOptions = { ...options, watching: true };
  let timer = null;
  let running = false;
  let pending = false;

  const scanNow = async () => {
    if (running) {
      pending = true;
      return;
    }
    running = true;
    do {
      pending = false;
      console.log(`\n[${new Date().toLocaleTimeString()}] Scanning...`);
      await runScan(scanOptions);
    } while (pending);
    running = false;
  };

  watch(target, { recursive: true }, (_event, filename) => {
    if (!filename || isIgnoredPath(filename.toString())) return;
    clearTimeout(timer);
    timer = setTimeout(scanNow, DEBOUNCE_MS);
  });

  await scanNow();
  console.log("\nWatching for changes. Press Ctrl+C to stop.");

  await new Promise(() => {});
  return 0;
}