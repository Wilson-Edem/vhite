import {
  readFile,
  writeFile,
} from "node:fs/promises";
import { runRules } from "./engine.js";
import {
  fixers as defaultFixers,
} from "./fixers/index.js";
import {
  prepareBackupDir,
  saveBackup,
  restoreBackup,
} from "./backup.js";

function summarize(issues) {
  const counts = new Map();

  for (const issue of issues) {
    const key = `${issue.rule}|${issue.message}`;

    counts.set(
      key,
      (counts.get(key) ?? 0) + 1
    );
  }

  return counts;
}

function isExpectedAfterFix(before, after, key) {
  const expected = new Map(before);

  if (!expected.get(key)) {
    return false;
  }

  const remaining = expected.get(key) - 1;

  if (remaining === 0) {
    expected.delete(key);
  } else {
    expected.set(key, remaining);
  }

  if (expected.size !== after.size) {
    return false;
  }

  for (const [name, count] of expected) {
    if (after.get(name) !== count) {
      return false;
    }
  }

  return true;
}

export async function proposeFixes(
  issues,
  { fixers = defaultFixers } = {}
) {
  const proposals = [];

  for (const issue of issues) {
    const fixer = fixers[issue.rule];

    if (!fixer) {
      continue;
    }

    const source = await readFile(issue.file, "utf8");

    if (fixer.apply(source, issue) === null) {
      continue;
    }

    const lineText = (
      source.split("\n")[issue.line - 1] ?? ""
    ).trim();

    proposals.push({
      ...issue,
      lineText,
    });
  }

  return proposals;
}

export async function applyApprovedFixes(
  root,
  proposals,
  {
    fixers = defaultFixers,
    disabledRules = new Set(),
  } = {}
) {
  const { changed } = await prepareBackupDir(root);
  const results = [];

  const ordered = [...proposals].sort(
    (a, b) =>
      a.file.localeCompare(b.file) ||
      b.line - a.line
  );

  let attempt = 0;

  for (const proposal of ordered) {
    attempt += 1;

    const fixer = fixers[proposal.rule];

    if (!fixer) {
      results.push({
        proposal,
        status: "skipped",
        reason: "No fixer is registered for this rule",
      });

      continue;
    }

    const source = await readFile(proposal.file, "utf8");
    const candidate = fixer.apply(source, proposal);

    if (candidate === null) {
      results.push({
        proposal,
        status: "skipped",
        reason: "The line no longer matches a safe fix",
      });

      continue;
    }

    const before = summarize(
      await runRules([proposal.file], { disabledRules })
    );

    const backupPath = await saveBackup(
      root,
      proposal.file,
      attempt
    );

    await writeFile(proposal.file, candidate, "utf8");

    const after = summarize(
      await runRules([proposal.file], { disabledRules })
    );

    const key = `${proposal.rule}|${proposal.message}`;

    if (isExpectedAfterFix(before, after, key)) {
      results.push({
        proposal,
        status: "applied",
        backupPath,
      });
    } else {
      await restoreBackup(proposal.file, backupPath);

      results.push({
        proposal,
        status: "rolled back",
        backupPath,
        reason:
          "The change did not fix the issue cleanly, so the original was restored",
      });
    }
  }

  return {
    results,
    gitignoreUpdated: changed,
  };
}
