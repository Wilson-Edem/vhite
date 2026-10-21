import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { rules } from "../rules/index.js";

const CONFIG_NAME = "vhite.config.json";
const knownRules = new Set(rules.map((rule) => rule.name));

export async function loadConfig(root) {
  let text;
  try {
    text = await readFile(join(root, CONFIG_NAME), "utf8");
  } catch (error) {
    if (error.code === "ENOENT") return { disabledRules: new Set(), warnings: [] };
    throw error;
  }

  let data;
  try {
    data = JSON.parse(text);
  } catch (error) {
    throw new Error(`${CONFIG_NAME} is not valid JSON: ${error.message}`);
  }

  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    throw new Error(`${CONFIG_NAME} must contain a JSON object`);
  }

  const requested = Array.isArray(data.disabledRules) ? data.disabledRules : [];
  const disabledRules = new Set();
  const warnings = [];

  for (const name of requested) {
    if (knownRules.has(name)) {
      disabledRules.add(name);
    } else {
      warnings.push(`"${name}" is not a rule name, so it was ignored`);
    }
  }

  return { disabledRules, warnings };
}

