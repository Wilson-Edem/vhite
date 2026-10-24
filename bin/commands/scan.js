import { resolve, join, relative } from "node:path";
import { existsSync } from "node:fs";
import { loadConfig } from "../../src/core/config.js";
import { CONFIG_NAME, canAskQuestions, runFirstTimeSetup } from "../../src/core/setup.js";
import { proposeFixes, applyApprovedFixes } from "../../src/fix/safe-fix.js";
import { chooseProposals } from "../../src/fix/approve.js";
import { deleteRunBackups } from "../../src/fix/backup.js";
import { FIX_DIR } from "../../src/fix/gitignore.js";
import { askYesNo, writeRunReport } from "../../src/output/run-report.js";
import { EXIT, decideExitCode } from "../../src/core/exit-codes.js";
import { formatJson } from "../../src/output/json-output.js";
import { formatSarif } from "../../src/output/sarif.js";
import { noteAll } from "../../src/smart/notes.js";
import { proposeSmartFixes, smartFixersFor } from "../../src/smart/fixes.js";
import { readSmartFixSetting, saveSmartFixSetting, askSmartFixConsent } from "../../src/smart/consent.js";
import { formatReport } from "../../src/output/reporter.js";
import { BASELINE_NAME, loadBaseline } from "../../src/scan/baseline.js";
import { readVersion } from "../../src/core/version.js";
import { BANNER } from "../output/text.js";
import {
  KNOWN_RULES,
  selectFiles,
  collectIssues,
  disabledSetFor,
  summaryLine,
} from "./shared.js";

async function resolveSmartFixSetting(target, interactive) {
  const saved = await readSmartFixSetting(target);
  if (saved !== undefined) return saved;
  if (!interactive) return false;
  const allowed = await askSmartFixConsent();
  await saveSmartFixSetting(target, allowed);
  return allowed;
}

export async function runScan(options) {
  const target = resolve(options.path ?? ".");
  const isText = options.format === "text";
  const showText = isText && !options.quiet;
  const interactive = canAskQuestions() && showText && !options.watching && !options.noPrompt;
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

    const config = await loadConfig(target);

    for (const warning of config.warnings) {
      say(`Warning: ${warning}`);
    }

    const disabled = disabledSetFor(config, options);
    if (disabled.size > 0 && showText) {
      say(`Rules turned off: ${[...disabled].join(", ")}`);
    }

    const baseline = options.useBaseline ? await loadBaseline(target) : null;

    files = await selectFiles(target, options);

    say(
      `vhite found ${files.length} front-end files in ${relative(process.cwd(), target) || "."}\n`
    );

    const first = await collectIssues(files, target, disabled, config, baseline);
    issues = first.issues;

    say(formatReport(issues, target));
    if (issues.length > 0) say(summaryLine(issues));
    if (first.hidden > 0) {
      say(`${first.hidden} known issue(s) hidden by ${BASELINE_NAME}`);
    }
    if (first.suppressed > 0) {
      say(`${first.suppressed} issue(s) skipped by vhite-disable comments`);
    }

    const errorFindings = issues.filter((issue) => issue.severity === "error");
    if (showText && errorFindings.length > 0 && !options.noPrompt && !options.watching) {
      const wantsAi =
        options.smartNotes ||
        (canAskQuestions() &&
          (await askYesNo("Want smart notes for the errors?")));
      if (wantsAi) {
        const explained = await noteAll(errorFindings, say);
        say(`Smart notes added: ${explained}`);
      }
    }

    const deterministic = await proposeFixes(issues);
    const smartSetting = options.noSmartFixes ? false : await resolveSmartFixSetting(target, interactive);
    const handled = new Set(deterministic.map((item) => `${item.file}:${item.line}`));
    let smartProposals = [];
    if (smartSetting && (interactive || options.fix)) {
      smartProposals = await proposeSmartFixes(issues, say, { skipLines: handled });
    }

    const proposals = [...deterministic, ...smartProposals];
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
      let gitignoreUpdated = false;
      const results = [];

      const plainChosen = chosen.filter((item) => !item.smartFix);
      if (plainChosen.length > 0) {
        const applied = await applyApprovedFixes(target, plainChosen, { disabledRules: disabled });
        results.push(...applied.results);
        gitignoreUpdated = gitignoreUpdated || applied.gitignoreUpdated;
      }

      const smartChosen = chosen.filter((item) => item.smartFix);
      if (smartChosen.length > 0) {
        const applied = await applyApprovedFixes(target, smartChosen, {
          disabledRules: disabled,
          fixers: smartFixersFor(smartChosen),
        });
        results.push(...applied.results);
        gitignoreUpdated = gitignoreUpdated || applied.gitignoreUpdated;
      }

      fixResults = results;

      if (gitignoreUpdated) {
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

      const rescan = await collectIssues(files, target, disabled, config, baseline);
      issues = rescan.issues;
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

    if (options.format === "sarif") {
      console.log(formatSarif({ root: target, issues, version: await readVersion() }));
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