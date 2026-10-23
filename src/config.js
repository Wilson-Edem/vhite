import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { rules } from "../rules/index.js";

const CONFIG_NAME = "vhite.config.json";
const knownRules = new Set(rules.map((rule) => rule.name));
const VALID_SEVERITIES = new Set(["error", "warning", "info", "off"]);

const DEFAULT_SEVERITY = {
  parser: "error",
  "hardcoded-secret": "error",
  "debugger-statement": "error",
  "console-log": "warning",
  "empty-catch": "warning",
  "unused-import": "warning",
  "empty-block": "warning",
  "leftover-todo": "info",
};

export function severityOf(name, config) {
  return config.severities.get(name) ?? DEFAULT_SEVERITY[name] ?? "warning";
}

export function applySeverity(issues, config) {
  for (const issue of issues) {
    issue.severity = severityOf(issue.rule, config);
  }
  return issues;
}

export async function loadConfig(root) {
  const empty = { disabledRules: new Set(), severities: new Map(), warnings: [] };

  let text;
  try {
    text = await readFile(join(root, CONFIG_NAME), "utf8");
  } catch (error) {
    if (error.code === "ENOENT") return empty;
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

  const config = { ...empty, disabledRules: new Set(), severities: new Map(), warnings: [] };

  const requested = Array.isArray(data.disabledRules) ? data.disabledRules : [];
  for (const name of requested) {
    if (knownRules.has(name)) {
      config.disabledRules.add(name);
    } else {
      config.warnings.push(`"${name}" is not a rule name, so it was ignored`);
    }
  }

  if (data.rules !== undefined) {
    if (typeof data.rules !== "object" || data.rules === null || Array.isArray(data.rules)) {
      throw new Error(`${CONFIG_NAME} "rules" must be an object`);
    }

    for (const [name, value] of Object.entries(data.rules)) {
      if (!knownRules.has(name)) {
        config.warnings.push(`"${name}" is not a rule name, so it was ignored`);
        continue;
      }

      const severity = typeof value === "string" ? value : value?.severity;
      if (!VALID_SEVERITIES.has(severity)) {
        config.warnings.push(
          `"${name}" has an unknown severity "${severity}", so the default was kept`
        );
        continue;
      }

      if (severity === "off") {
        config.disabledRules.add(name);
      } else {
        config.severities.set(name, severity);
      }
    }
  }

  return config;
}