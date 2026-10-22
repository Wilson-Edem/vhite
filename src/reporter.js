import { relative } from "node:path";
import { explanations } from "./explanations.js";

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
    fileIssues.sort((a, b) => a.line - b.line);
    for (const issue of fileIssues) {
      lines.push(`  Line ${issue.line}: ${issue.message} [${issue.rule}]`);
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