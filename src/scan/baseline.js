import { readFile, writeFile } from "node:fs/promises";
import { join, relative, sep } from "node:path";

export const BASELINE_NAME = "vhite.baseline.json";

function toPosix(path) {
  return path.split(sep).join("/");
}

export function fingerprintOf(issue, root) {
  const text = (issue.snippet ?? issue.message).trim();
  return `${issue.rule}|${toPosix(relative(root, issue.file))}|${text}`;
}

export function buildBaseline(issues, root) {
  const fingerprints = {};
  for (const issue of issues) {
    const key = fingerprintOf(issue, root);
    fingerprints[key] = (fingerprints[key] ?? 0) + 1;
  }
  return { version: 1, fingerprints };
}

export async function saveBaseline(root, baseline) {
  const path = join(root, BASELINE_NAME);
  await writeFile(path, JSON.stringify(baseline, null, 2) + "\n", "utf8");
  return path;
}

export async function loadBaseline(root) {
  try {
    const text = await readFile(join(root, BASELINE_NAME), "utf8");
    const data = JSON.parse(text);
    if (typeof data.fingerprints !== "object" || data.fingerprints === null) {
      throw new Error(`${BASELINE_NAME} has no fingerprints`);
    }
    return data;
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

export function applyBaseline(issues, baseline, root) {
  const remaining = { ...baseline.fingerprints };
  const fresh = [];
  let hidden = 0;

  for (const issue of issues) {
    const key = fingerprintOf(issue, root);
    if ((remaining[key] ?? 0) > 0) {
      remaining[key] -= 1;
      hidden += 1;
    } else {
      fresh.push(issue);
    }
  }

  return { issues: fresh, hidden };
}