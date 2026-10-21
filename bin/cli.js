#!/usr/bin/env node

import { resolve, join, relative } from "node:path";
import { existsSync } from "node:fs";

import { findFiles } from "../src/files.js";
import { runRules } from "../src/engine.js";
import { formatReport } from "../src/reporter.js";
import { loadConfig } from "../src/config.js";

import {
  CONFIG_NAME,
  canAskQuestions,
  runFirstTimeSetup,
} from "../src/setup.js";

import {
  proposeFixes,
  applyApprovedFixes,
} from "../src/safe-fix.js";

import { chooseProposals } from "../src/approve.js";
import { deleteRunBackups } from "../src/backup.js";
import { FIX_DIR } from "../src/gitignore.js";

import {
  askYesNo,
  writeRunReport,
} from "../src/run-report.js";

// Capture terminal messages so the report can include them.
const logs = [];

const originalLog = console.log;
const originalWarn = console.warn;
const originalError = console.error;

function capture(method, label = "") {
  return (...args) => {
    const message = args
      .map((arg) => {
        if (typeof arg === "string") {
          return arg;
        }

        try {
          return JSON.stringify(arg) ?? String(arg);
        } catch {
          return String(arg);
        }
      })
      .join(" ");

    logs.push(label ? `${label}: ${message}` : message);
    method(...args);
  };
}

console.log = capture(originalLog);
console.warn = capture(originalWarn, "WARN");
console.error = capture(originalError, "ERROR");

const startedAt = new Date();
const target = resolve(process.argv[2] ?? ".");

let files = [];
let issues = [];
let proposals = [];
let fixResults = [];
let backupCleanup = null;
let config = null;

console.log(
  `vhite is installed and running
   loading..
             ....  
                  ...... 
                         ........
   Done..`
);

try {
  if (
    !existsSync(join(target, CONFIG_NAME)) &&
    canAskQuestions()
  ) {
    await runFirstTimeSetup(target);
  }

  config = await loadConfig(target);

  for (const warning of config.warnings) {
    console.log(`Warning: ${warning}`);
  }

  if (config.disabledRules.size > 0) {
    console.log(
      `Rules turned off by config: ${[...config.disabledRules].join(", ")}`
    );
  }

  files = await findFiles(target);

  console.log(
    `vhite found ${files.length} front-end files in ${relative(process.cwd(), target) || "."}\n`
  );

  issues = await runRules(files, {
    disabledRules: config.disabledRules,
  });

  console.log(formatReport(issues, target));
  proposals = await proposeFixes(issues);

  if (proposals.length > 0 && canAskQuestions()) {
    const chosen = await chooseProposals(target, proposals);

    if (chosen.length > 0) {
      const result = await applyApprovedFixes(
        target,
        chosen,
        { disabledRules: config.disabledRules }
      );

      fixResults = result.results;

      if (result.gitignoreUpdated) {
        console.log(`Added ${FIX_DIR}/ to .gitignore`);
      }

      for (const item of fixResults) {
        if (item.status === "applied") {
          console.log(
            `Applied: ${relative(target, item.proposal.file)} line ${item.proposal.line}`
          );
        } else {
          const label = item.status === "skipped" ? "Skipped" : "Rolled back";
          console.log(
            `${label}: ${relative(target, item.proposal.file)} line ${item.proposal.line}. ${item.reason}`
          );
        }
      }
    }
  }

  // Feature 1: Ask whether to remove current-run backups.
  const hasRunBackups = fixResults.some(
    (item) => typeof item.backupPath === "string"
  );

  if (canAskQuestions() && hasRunBackups) {
    const shouldDelete = await askYesNo(
      "Do you want to delete the backup files created during this run?"
    );

    if (shouldDelete) {
      const result = await deleteRunBackups(fixResults);
      backupCleanup = {
        requested: true,
        deleted: result.deleted,
      };

      console.log(
        `Deleted ${result.deleted} backup file(s) created during this run.`
      );
    } else {
      backupCleanup = {
        requested: false,
        deleted: 0,
      };

      console.log("Kept the backup files created during this run.");
    }
  }

  console.log("\nVhite run completed.");

  // Feature 2: Offer a detailed Markdown report.
  if (canAskQuestions()) {
    const shouldCreateReport = await askYesNo(
      "Would you like to create a detailed Markdown report of this run?"
    );

    if (shouldCreateReport) {
      // Include the log messages generated before report creation.
      const reportLogs = [...logs];
      const finishedAt = new Date();

      const result = await writeRunReport({
        root: target,
        target,
        startedAt,
        finishedAt,
        filesScanned: files.length,
        issues,
        proposals,
        fixResults,
        logs: reportLogs,
        backupCleanup,
      });

      if (result.gitignoreUpdated) {
        console.log(`Added ${FIX_DIR}/ to .gitignore`);
      }

      console.log(
        `Report created successfully: ${relative(target, result.reportPath)}`
      );
    } else {
      console.log("Report generation skipped.");
    }
  }
} catch (error) {
  console.error(`Error: ${error.message}`);
  process.exitCode = 1;
}
