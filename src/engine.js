import { readFile } from "node:fs/promises";
import { rules } from "../rules/index.js";

export async function runRules(files) {
  const issues = [];

  for (const file of files) {
    const source = await readFile(file, "utf8");

    for (const rule of rules) {
      const found = rule.check({ file, source });
      for (const issue of found) {
        issues.push({ rule: rule.name, file, ...issue });
      }
    }
  }

  return issues;
}