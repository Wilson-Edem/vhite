import { relative } from "node:path";
import { explanations } from "./explanations.js";

function caretFor(issue) {
  const startColumn = issue.column ?? 1;
  const width =
    issue.endLine === issue.line && issue.endColumn > startColumn
      ? issue.endColumn - startColumn
      : Math.max(1, issue.snippet.length - startColumn + 1);
  return " ".repeat(startColumn - 1) + "^".repeat(width);
}

export function formatReport(issues, root) {
  if (issues.length === 0) return "No issues found.";

  const byFile = new Map();
  for (const issue of issues) {
    if (!byFile.has(issue.file)) byFile.set(issue.file, []);
    byFile.get(issue.file).push(issue);
  }

  const lines = [];
  const sortedFiles = [...byFile.keys()].sort((a, b) =>
    relative(root, a).localeCompare(relative(root, b))
  );
  for (const file of sortedFiles) {
    const fileIssues = byFile.get(file);
    lines.push(relative(root, file));
    fileIssues.sort(
      (a, b) => a.line - b.line || (a.column ?? 1) - (b.column ?? 1)
    );
    for (const issue of fileIssues) {
      lines.push(`  Line ${issue.line}: ${issue.message} [${issue.rule}]`);

      if (issue.snippet !== undefined && issue.endLine !== undefined) {
        const gutter = String(issue.line);
        const blank = " ".repeat(gutter.length);
        lines.push(`    ${gutter} | ${issue.snippet}`);
        lines.push(`    ${blank} | ${caretFor(issue)}`);
      }

      const info = explanations[issue.rule];
      if (info) {
        lines.push(`    What happened: ${info.whatHappened}`);
        lines.push(`    Proposed change: ${info.proposedChange}`);
      }
      lines.push("");
    }
  }
  lines.push(`${issues.length} issue(s) in ${byFile.size} file(s)`);
  return lines.join("\n");
}