import { relative, sep } from "node:path";

function toPosix(path) {
  return path.split(sep).join("/");
}

export function formatJson({ root, filesScanned, issues, fixes = [], version }) {
  const counts = { error: 0, warning: 0, info: 0 };
  for (const issue of issues) {
    counts[issue.severity] = (counts[issue.severity] ?? 0) + 1;
  }

  const sorted = [...issues].sort(
    (a, b) =>
      a.file.localeCompare(b.file) ||
      a.line - b.line ||
      (a.column ?? 1) - (b.column ?? 1)
  );

  return JSON.stringify(
    {
      version,
      root: toPosix(root),
      filesScanned,
      summary: { total: issues.length, ...counts },
      issues: sorted.map((issue) => ({
        rule: issue.rule,
        severity: issue.severity,
        file: toPosix(relative(root, issue.file)),
        line: issue.line,
        column: issue.column ?? 1,
        endLine: issue.endLine ?? issue.line,
        endColumn: issue.endColumn ?? issue.column ?? 1,
        message: issue.message,
        snippet: issue.snippet,
      })),
      fixes: fixes.map((result) => ({
        rule: result.proposal.rule,
        file: toPosix(relative(root, result.proposal.file)),
        line: result.proposal.line,
        status: result.status,
      })),
    },
    null,
    2
  );
}