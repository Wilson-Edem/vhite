import { readFile } from "node:fs/promises";

export const DEFAULT_ENDPOINT = "https://victor-edem.vercel.app/api/explain";
const CONTEXT_LINES = 5;

const SECRET_PATTERNS = [
  /\b(?:api[_-]?key|access[_-]?token|auth[_-]?token|client[_-]?secret|secret[_-]?key|password)\b\s*[:=]\s*["'`][^"'`\s]{8,}["'`]/gi,
  /\b(?:sk-[A-Za-z0-9_-]{16,}|gh[pousr]_[A-Za-z0-9_]{20,}|AKIA[0-9A-Z]{16})\b/g,
];

export function redact(text) {
  let output = text;
  for (const pattern of SECRET_PATTERNS) {
    output = output.replace(pattern, "[REDACTED]");
  }
  return output;
}

export function contextFor(source, line) {
  const lines = source.split("\n");
  const start = Math.max(0, line - 1 - CONTEXT_LINES);
  const end = Math.min(lines.length, line + CONTEXT_LINES);
  return lines.slice(start, end).join("\n");
}

export async function explainIssue(issue, source, { endpoint, fetchImpl = fetch } = {}) {
  const snippet = redact(contextFor(source, issue.line));
    const url = endpoint || process.env.VHITE_AI_URL || "https://victor-edem.vercel.app/api/explain";
  const response = await fetchImpl(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      rule: issue.rule,
      message: issue.message,
      snippet,
      language: "javascript",
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (response.status === 429) return { limited: true };
  if (!response.ok) throw new Error(data.error ?? `AI service returned ${response.status}`);
  return { text: data.explanation, remaining: data.remaining };
}

export async function explainAll(issues, say, { fetchImpl = fetch, endpoint } = {}) {
  const cache = new Map();
  let explained = 0;

  for (const issue of issues) {
    if (!cache.has(issue.file)) {
      cache.set(issue.file, await readFile(issue.file, "utf8"));
    }

    let result;
    try {
      result = await explainIssue(issue, cache.get(issue.file), { endpoint, fetchImpl });
    } catch (error) {
      say(`AI explanation unavailable: ${error.message}`);
      return explained;
    }

    if (result.limited) {
      say("Daily AI explanation limit reached (20 per day). Try again tomorrow.");
      return explained;
    }

    say(`  AI note for line ${issue.line} [${issue.rule}]: ${result.text}`);
    explained += 1;
  }

  return explained;
}