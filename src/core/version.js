import { readFile } from "node:fs/promises";

export async function readVersion() {
  const text = await readFile(new URL("../../package.json", import.meta.url), "utf8");
  return JSON.parse(text).version;
}