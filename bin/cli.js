#!/usr/bin/env node

import { resolve, join, relative, sep } from "node:path";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";

import { findFiles } from "../src/files.js";
import { runRules } from "../src/engine.js";
import { formatReport } from "../src/reporter.js";
import { loadConfig, applySeverity, severityOf } from "../src/config.js";
import { CONFIG_NAME, canAskQuestions, runFirstTimeSetup } from "../src/setup.js";
import { proposeFixes, applyApprovedFixes } from "../src/safe-fix.js";
import { chooseProposals } from "../src/approve.js";
import { deleteRunBackups } from "../src/backup.js";
import { FIX_DIR } from "../src/gitignore.js";
import { askYesNo, writeRunReport } from "../src/run-report.js";
import { parseArgs, UsageError, isIncluded } from "../src/args.js";
import { EXIT, decideExitCode } from "../src/exit-codes.js";
import { formatJson } from "../src/json-output.js";
import { rules } from "../rules/index.js";
import { explanations } from "../src/explanations.js";
import { fixers } from "../src/fixers/index.js";

const USAGE = `Usage:
  vhite [path]              Scan a folder (default command)
  vhite scan [path]         Scan and report
  vhite fix [path]          Scan, then choose which fixes to apply
  vhite rules               List all rules
  vhite explain <rule>      Explain one rule
  vhite version             Show the version

Options:
  --format text|json        Output format (default: text)
  --quiet, -q               Print only errors; the exit code still applies
  --fix                     Apply all safe fixes without asking, then rescan
  --rule <name>             Run only this rule (repeatable)
  --disable <name>          Turn off a rule (repeatable)
  --include <path>          Scan only files under this path (repeatable)
  --exclude <path>          Skip files under this path (repeatable)
  --help, -h                Show this help

Exit codes:
  0  no problems
  1  problems found (errors or warnings; info notes do not count)
  2  configuration or runtime error
  3  fixes applied and no problems remain
  4  fixes were rolled back`;

const BANNER = `vhite is installed and running
   loading..
             ....
                  ......
                         ........
   Done..`;

const KNOWN_RULES = new Set(rules.map((rule) => rule.name));

async function readVersion() {
  const text = await readFile(new URL("../package.json", import.meta.url), "utf8");
  return JSON.parse(text).version;
}

function listRules() {
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

function explainRule(name) {
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

function summaryLine(issues) {
  const counts = { error: 0, warning: 0, info: 0 };
  for (const issue of issues) {
    counts[issue.severity] = (counts[issue.severity] ?? 0) + 1;
  }
  return `Errors: ${counts.error}  Warnings: ${counts.warning}  Info: ${counts.info}`;
}

async function runScan(options) {
  const target = resolve(options.path ?? ".");
  const isText = options.format === "text";
  const showText = isText && !options.quiet;
  const interactive = canAskQuestions() && showText;
  const logs = [];
  const startedAt = new Date();

  const say = (message = "") => {
    logs.push(message);
    if (showText) console.log(message);
  };

  const unknown = [...options.rules, ...options.disable].filter(
    (name) => !KNOWN_RULES.has(name)
  );
  if (unknown.length > 0) {
    console.error(`Error: unknown rule name(s): ${unknown.join(", ")}`);
    return EXIT.ERROR;
  }

  let config;
  let issues = [];
  let files = [];
  let fixResults = [];
  let backupCleanup = null;

  try {
    if (showText && !options.quiet) {
      console.log(BANNER);
    }

    if (!existsSync(join(target, CONFIG_NAME)) && interactive) {
      await runFirstTimeSetup(target);
    }

    config = await loadConfig(target);

    for (const warning of config.warnings) {
      say(`Warning: ${warning}`);
    }

    const disabled = new Set([...config.disabledRules, ...options.disable]);
    if (options.rules.length > 0) {
      const only = new Set(options.rules);
      for (const rule of rules) {
        if (!only.has(rule.name)) disabled.add(rule.name);
      }
    }

    if (disabled.size > 0 && showText) {
      say(`Rules turned off: ${[...disabled].join(", ")}`);
    }

    const allFiles = await findFiles(target);
    files = allFiles.filter((file) =>
      isIncluded(relative(target, file), options.include, options.exclude)
    );

    say(
      `vhite found ${files.length} front-end files in ${relative(process.cwd(), target) || "."}\n`
    );

    issues = applySeverity(
      await runRules(files, { disabledRules: disabled }),
      config
    );

    say(formatReport(issues, target));
    if (issues.length > 0) say(summaryLine(issues));

    const proposals = await proposeFixes(issues);
    let chosen = [];

    if (proposals.length > 0) {
      if (options.fix) {
        chosen = proposals;
      } else if (interactive) {
        chosen = await chooseProposals(target, proposals);
      } else if (options.command === "fix") {
        console.error(
          "Error: vhite fix needs an interactive terminal. Use --fix to apply all safe fixes."
        );
        return EXIT.ERROR;
      }
    }

    if (chosen.length > 0) {
      const result = await applyApprovedFixes(target, chosen, { disabledRules: disabled });
      fixResults = result.results;

      if (result.gitignoreUpdated) {
        say(`Added ${FIX_DIR}/ to .gitignore`);
      }

      for (const item of fixResults) {
        const where = `${relative(target, item.proposal.file)} line ${item.proposal.line}`;
        if (item.status === "applied") {
          say(`Applied: ${where}`);
        } else {
          const label = item.status === "skipped" ? "Skipped" : "Rolled back";
          say(`${label}: ${where}. ${item.reason}`);
        }
      }

      issues = applySeverity(
        await runRules(files, { disabledRules: disabled }),
        config
      );
      say(`Final scan: ${issues.length} issue(s) remaining`);
    }

    const hasRunBackups = fixResults.some((item) => typeof item.backupPath === "string");

    if (interactive && hasRunBackups) {
      const shouldDelete = await askYesNo(
        "Do you want to delete the backup files created during this run?"
      );

      if (shouldDelete) {
        const result = await deleteRunBackups(fixResults);
        backupCleanup = { requested: true, deleted: result.deleted };
        say(`Deleted ${result.deleted} backup file(s) created during this run.`);
      } else {
        backupCleanup = { requested: false, deleted: 0 };
        say("Kept the backup files created during this run.");
      }
    }

    if (showText) say("\nVhite run completed.");

    if (interactive) {
      const shouldCreateReport = await askYesNo(
        "Would you like to create a detailed Markdown report of this run?"
      );

      if (shouldCreateReport) {
        const result = await writeRunReport({
          root: target,
          target,
          startedAt,
          finishedAt: new Date(),
          filesScanned: files.length,
          issues,
          proposals: await proposeFixes(issues),
          fixResults,
          logs: [...logs],
          backupCleanup,
        });

        if (result.gitignoreUpdated) {
          say(`Added ${FIX_DIR}/ to .gitignore`);
        }
        say(`Report created successfully: ${relative(target, result.reportPath)}`);
      } else {
        say("Report generation skipped.");
      }
    }

    if (options.format === "json") {
      console.log(
        formatJson({
          root: target,
          filesScanned: files.length,
          issues,
          fixes: fixResults,
          version: await readVersion(),
        })
      );
    }

    const failing = issues.filter(
      (issue) => issue.severity === "error" || issue.severity === "warning"
    ).length;

    return decideExitCode({
      rolledBack: fixResults.filter((item) => item.status === "rolled back").length,
      issues: failing,
      applied: fixResults.filter((item) => item.status === "applied").length,
    });
  } catch (error) {
    console.error(`Error: ${error.message}`);
    return EXIT.ERROR;
  }
}

async function main() {
  let options;
  try {
    options = parseArgs(process.argv.slice(2));
  } catch (error) {
    if (error instanceof UsageError) {
      console.error(`Error: ${error.message}\n`);
      console.error(USAGE);
      return EXIT.ERROR;
    }
    throw error;
  }

  if (options.command === "help") {
    console.log(USAGE);
    return EXIT.CLEAN;
  }

  if (options.command === "version") {
    console.log(await readVersion());
    return EXIT.CLEAN;
  }

  if (options.command === "rules") {
    return listRules();
  }

  if (options.command === "explain") {
    return explainRule(options.ruleName);
  }

  return runScan(options);
}

process.exitCode = await main();