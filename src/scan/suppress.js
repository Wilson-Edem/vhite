import { readFile } from "node:fs/promises";

const DIRECTIVE = /vhite-disable-(next-line|line)(?:\s+([A-Za-z0-9_,\- ]+))?/;

function parseRules(text) {
  if (!text || text.trim() === "") return null;
  return new Set(
    text
      .split(/[, ]+/)
      .map((name) => name.trim())
      .filter((name) => name !== "")
  );
}

function directivesFor(source) {
  const lines = source.split(/\r?\n/);
  const map = new Map();

  lines.forEach((text, index) => {
    const match = DIRECTIVE.exec(text);
    if (!match) return;

    const target = match[1] === "next-line" ? index + 2 : index + 1;
    map.set(target, parseRules(match[2]));
  });

  return map;
}

export async function applySuppressions(issues, root) {
  const cache = new Map();
  const kept = [];
  let suppressed = 0;

  for (const issue of issues) {
    if (!cache.has(issue.file)) {
      const source = await readFile(issue.file, "utf8");
      cache.set(issue.file, directivesFor(source));
    }

    const directives = cache.get(issue.file);
    const entry = directives.get(issue.line);
    const hides = entry !== undefined && (entry === null || entry.has(issue.rule));

    if (hides) {
      suppressed += 1;
    } else {
      kept.push(issue);
    }
  }

  return { issues: kept, suppressed };
}