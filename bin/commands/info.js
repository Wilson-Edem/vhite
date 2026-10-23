import { severityOf } from "../../src/core/config.js";
import { EXIT } from "../../src/core/exit-codes.js";
import { fixers } from "../../src/fix/fixers/index.js";
import { explanations } from "../../src/output/explanations.js";
import { rules } from "../../rules/index.js";
import { KNOWN_RULES } from "./shared.js";

export function listRules() {
  console.log("Rule                  Severity  Fix   Description");
  for (const rule of rules) {
    const severity = severityOf(rule.name, { severities: new Map() });
    const fixable = fixers[rule.name] ? "yes" : "no";
    console.log(
      `${rule.name.padEnd(22)}${severity.padEnd(10)}${fixable.padEnd(6)}${rule.description}`
    );
  }
  return EXIT.CLEAN;
}

export function explainRule(name) {
  if (!KNOWN_RULES.has(name)) {
    console.error(`Error: unknown rule "${name}"`);
    console.error(`Known rules: ${[...KNOWN_RULES].join(", ")}`);
    return EXIT.ERROR;
  }

  const rule = rules.find((item) => item.name === name);
  const info = explanations[name];

  console.log(name);
  console.log(`  ${rule.description}`);
  if (info) {
    console.log(`  What happened: ${info.whatHappened}`);
    console.log(`  Proposed change: ${info.proposedChange}`);
  }
  console.log(`  Default severity: ${severityOf(name, { severities: new Map() })}`);
  console.log(`  Automatic fix: ${fixers[name] ? "yes" : "no"}`);
  return EXIT.CLEAN;
}