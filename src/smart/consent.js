import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createInterface } from "node:readline/promises";

const CONFIG_NAME = "vhite.config.json";

async function readConfigObject(root) {
  try {
    return JSON.parse(await readFile(join(root, CONFIG_NAME), "utf8"));
  } catch {
    return {};
  }
}

export async function readSmartFixSetting(root) {
  const data = await readConfigObject(root);
  return typeof data.smartFixes === "boolean" ? data.smartFixes : undefined;
}

export async function saveSmartFixSetting(root, value) {
  const data = await readConfigObject(root);
  data.smartFixes = value;
  await writeFile(join(root, CONFIG_NAME), JSON.stringify(data, null, 2) + "\n", "utf8");
}

export async function askSmartFixConsent() {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = (await rl.question("Enable smart fixes for files with findings? (Y/n): ")).trim().toLowerCase();
    return answer === "" || answer === "y" || answer === "yes";
  } finally {
    rl.close();
  }
}