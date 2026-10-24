import { readFile } from "node:fs/promises";
import { redact } from "./notes.js";

export const DEFAULT_FIX_ENDPOINT = "https://victor-edem.vercel.app/api/smart-fixes";
const MAX_CODE_CHARS = 12000;
const MAX_FINDINGS_PER_REQUEST = 30;
const CONCURRENCY = 4;
const FIXABLE = new Set(["error", "warning"]);

export function groupByFile(issues) {
  const groups = new Map();
  for (const issue of issues) {
    if (!FIXABLE.has(issue.severity)) continue;
    if (!groups.has(issue.file)) groups.set(issue.file, []);
    groups.get(issue.file).push(issue);
  }
  return groups;
}

export function validateEdits(edits, text, findings) {
  const lines = text.split("\n");
  const seen = new Set();
  const accepted = [];

  for (const edit of Array.isArray(edits) ? edits : []) {
    if (!edit || !Number.isInteger(edit.line) || seen.has(edit.line)) continue;
    const finding = findings.find((item) => item.line === edit.line);
    if (!finding) continue;
    if (lines[edit.line - 1] !== edit.original) continue;
    if (typeof edit.replacement !== "string" || edit.replacement.includes("\n")) continue;
    if (edit.replacement.trim() === edit.original.trim()) continue;
    seen.add(edit.line);
    accepted.push({ line: edit.line, original: edit.original, replacement: edit.replacement, finding });
  }
  return accepted;
}

export function toProposals(file, accepted) {
  return accepted.map((edit) => ({
    file,
    line: edit.line,
    rule: edit.finding.rule,
    message: edit.finding.message,
    lineText: edit.original.trim(),
    original: edit.original,
    replacement: edit.replacement,
    smartFix: true,
  }));
}

export function smartFixerFor(rule) {
  return {
    rule,
    apply(source, issue) {
      const lines = source.split("\n");
      if (lines[issue.line - 1] !== issue.original) return null;
      if (issue.replacement === "") {
        lines.splice(issue.line - 1, 1);
      } else {
        lines[issue.line - 1] = issue.replacement;
      }
      return lines.join("\n");
    },
  };
}

export function smartFixersFor(proposals) {
  const fixers = {};
  for (const proposal of proposals) {
    fixers[proposal.rule] = smartFixerFor(proposal.rule);
  }
  return fixers;
}

async function requestEdits(text, findings, { endpoint, fetchImpl }) {
  const response = await fetchImpl(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      language: "javascript",
      code: text,
      findings: findings.slice(0, MAX_FINDINGS_PER_REQUEST).map((item) => ({
        line: item.line,
        rule: item.rule,
        message: item.message,
      })),
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (response.status === 429) return { limited: true, edits: [] };
  if (!response.ok) throw new Error(data.error ?? `Smart service returned ${response.status}`);
  return { edits: data.edits ?? [] };
}

export async function proposeSmartFixes(issues, say, { endpoint = DEFAULT_FIX_ENDPOINT, fetchImpl = fetch, skipLines = new Set() } = {}) {
  const groups = [...groupByFile(issues).entries()];
  const proposals = [];
  let stopped = false;

  const worker = async () => {
    while (groups.length > 0 && !stopped) {
      const [file, findings] = groups.shift();
      const name = file;

      let text;
      try {
        text = await readFile(file, "utf8");
      } catch {
        say(`Smart fixes skipped for ${name}: file could not be read`);
        continue;
      }

      if (text.length > MAX_CODE_CHARS) {
        say(`Smart fixes skipped for ${name}: file is too large to send`);
        continue;
      }
      if (redact(text) !== text) {
        say(`Smart fixes skipped for ${name}: it contains a secret-looking value`);
        continue;
      }

      const usable = findings.filter((item) => !skipLines.has(`${file}:${item.line}`));
      if (usable.length === 0) continue;

      try {
        const result = await requestEdits(text, usable, { endpoint, fetchImpl });
        if (result.limited) {
          say("Daily smart fix limit reached. Try again tomorrow.");
          stopped = true;
          return;
        }
        const accepted = validateEdits(result.edits, text, usable);
        proposals.push(...toProposals(file, accepted));
      } catch (error) {
        say(`Smart fixes unavailable for ${name}: ${error.message}`);
      }
    }
  };

  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));
  return proposals;
}