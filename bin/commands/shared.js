import { resolve, relative } from "node:path";
import { findFiles } from "../../src/core/files.js";
import { runRules } from "../../src/core/engine.js";
import { applySeverity } from "../../src/core/config.js";
import { isIncluded } from "../../src/core/args.js";
import { loadIgnorePatterns, isIgnored } from "../../src/scan/ignore.js";
import { changedFiles } from "../../src/scan/git.js";
import { applySuppressions } from "../../src/scan/suppress.js";
import { applyBaseline } from "../../src/scan/baseline.js";
import { rules } from "../../rules/index.js";

export const KNOWN_RULES = new Set(rules.map((rule) => rule.name));

export function summaryLine(issues) {
  const counts = { error: 0, warning: 0, info: 0 };
  for (const issue of issues) {
    counts[issue.severity] = (counts[issue.severity] ?? 0) + 1;
  }
  return `Errors: ${counts.error}  Warnings: ${counts.warning}  Info: ${counts.info}`;
}

export async function selectFiles(target, options) {
  const patterns = await loadIgnorePatterns(target);
  const allFiles = await findFiles(target);

  let files = allFiles.filter((file) => {
    const rel = relative(target, file);
    return !isIgnored(rel, patterns) && isIncluded(rel, options.include, options.exclude);
  });

  if (options.changed || options.staged) {
    const changed = await changedFiles(target, options.staged ? "staged" : "changed");
    files = files.filter((file) => changed.has(resolve(file)));
  }

  return files;
}

export async function collectIssues(files, target, disabled, config, baseline) {
  const found = applySeverity(
    await runRules(files, { disabledRules: disabled }),
    config
  );

  const suppressed = await applySuppressions(found, target);
  let issues = suppressed.issues;
  let hidden = 0;

  if (baseline) {
    const applied = applyBaseline(issues, baseline, target);
    issues = applied.issues;
    hidden = applied.hidden;
  }

  return { issues, suppressed: suppressed.suppressed, hidden };
}

export function disabledSetFor(config, options) {
  const disabled = new Set([...config.disabledRules, ...options.disable]);
  if (options.rules.length > 0) {
    const only = new Set(options.rules);
    for (const rule of rules) {
      if (!only.has(rule.name)) disabled.add(rule.name);
    }
  }
  return disabled;
}