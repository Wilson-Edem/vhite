import {
  mkdir,
  writeFile,
} from "node:fs/promises";
import { join, relative } from "node:path";
import { createInterface } from "node:readline/promises";
import {
  FIX_DIR,
  ensureGitignoreEntry,
} from "../fix/gitignore.js";

function escapeMarkdown(value) {
  return String(value ?? "")
    .replace(/\|/g, "\\|")
    .replace(/\r?\n/g, " ");
}

export function formatMarkdownRunReport({
  root,
  target = root,
  startedAt = new Date(),
  finishedAt = new Date(),
  filesScanned = 0,
  issues = [],
  proposals = [],
  fixResults = [],
  logs = [],
  backupCleanup = null,
}) {
  const applied = fixResults.filter(
    (item) => item.status === "applied"
  ).length;

  const skipped = fixResults.filter(
    (item) => item.status === "skipped"
  ).length;

  const rolledBack = fixResults.filter(
    (item) => item.status === "rolled back"
  ).length;

  const lines = [
    "# Vhite CLI — Run Report",
    "",
    "## Run overview",
    "",
    `- **Project:** \`${target}\``,
    `- **Started:** ${startedAt.toISOString()}`,
    `- **Finished:** ${finishedAt.toISOString()}`,
    `- **Files scanned:** ${filesScanned}`,
    `- **Issues detected:** ${issues.length}`,
    `- **Fix proposals:** ${proposals.length}`,
    `- **Fixes applied:** ${applied}`,
    `- **Fixes skipped:** ${skipped}`,
    `- **Fixes rolled back:** ${rolledBack}`,
    "",
    "## Issues detected",
    "",
  ];

  if (issues.length === 0) {
    lines.push("No issues were detected.", "");
  } else {
    lines.push(
      "| File | Line | Rule | Finding |",
      "|---|---:|---|---|"
    );

    for (const issue of issues) {
      lines.push(
        `| \`${escapeMarkdown(relative(root, issue.file))}\` | ${issue.line} | \`${escapeMarkdown(issue.rule)}\` | ${escapeMarkdown(issue.message)} |`
      );
    }

    lines.push("");
  }

  lines.push("## Fix results", "");

  if (fixResults.length === 0) {
    lines.push("No fixes were applied during this run.", "");
  } else {
    lines.push(
      "| Status | File | Line | Rule | Details |",
      "|---|---|---:|---|---|"
    );

    for (const result of fixResults) {
      const proposal = result.proposal ?? {};
      const file = proposal.file
        ? relative(root, proposal.file)
        : "—";

      lines.push(
        `| ${escapeMarkdown(result.status)} | \`${escapeMarkdown(file)}\` | ${proposal.line ?? "—"} | \`${escapeMarkdown(proposal.rule ?? "—")}\` | ${escapeMarkdown(result.reason ?? "No additional details")} |`
      );
    }

    lines.push("");
  }

  lines.push("## Backup management", "");

  if (backupCleanup) {
    lines.push(
      `- **Cleanup requested:** ${backupCleanup.requested ? "Yes" : "No"}`,
      `- **Backup files deleted:** ${backupCleanup.deleted ?? 0}`,
      `- **Backups retained:** ${backupCleanup.requested ? "No current-run backups were intentionally retained by cleanup" : "Current-run backups were kept"}`,
      ""
    );
  } else {
    lines.push("No backup cleanup decision was recorded.", "");
  }

  lines.push("## Terminal log", "", "```text");

  if (logs.length === 0) {
    lines.push("No captured terminal log entries.");
  } else {
    lines.push(...logs);
  }

  lines.push(
    "```",
    "",
    "## Final notes",
    "",
    "- Review any unresolved findings.",
    "- A rolled-back fix means the original file was restored after verification failed.",
    "- Run your project's tests before shipping changes.",
    ""
  );

  return lines.join("\n");
}

export async function writeRunReport(options) {
  const { root } = options;

  const reportDir = join(root, FIX_DIR, "reports");
  const gitignoreUpdated = await ensureGitignoreEntry(root);

  await mkdir(reportDir, { recursive: true });

  const timestamp = (options.finishedAt ?? new Date())
    .toISOString()
    .replace(/[:.]/g, "-");

  const filename = `vhite-report-${timestamp}.md`;
  const reportPath = join(reportDir, filename);
  const content = formatMarkdownRunReport(options);

  await writeFile(reportPath, content, "utf8");

  return {
    reportPath,
    content,
    gitignoreUpdated,
  };
}

export async function askYesNo(
  question,
  { defaultYes = false } = {}
) {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  try {
    const suffix = defaultYes ? " (Y/n): " : " (y/N): ";
    const answer = (
      await rl.question(question + suffix)
    ).trim().toLowerCase();

    if (answer === "") {
      return defaultYes;
    }

    if (["y", "yes"].includes(answer)) {
      return true;
    }

    if (["n", "no"].includes(answer)) {
      return false;
    }

    console.log("Please enter y or n. Your answer defaults to No.");
    return false;
  } finally {
    rl.close();
  }
}
