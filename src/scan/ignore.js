import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { normalizePath } from "../core/args.js";

const DEFAULT_IGNORES = [
  "node_modules",
  ".git",
  "dist",
  "build",
  "coverage",
  ".next",
  "vendor",
  ".vhite-fix",
];

function globToRegex(glob) {
  let source = "";
  for (let index = 0; index < glob.length; index += 1) {
    const char = glob[index];
    if (char === "*" && glob[index + 1] === "*") {
      source += ".*";
      index += 1;
    } else if (char === "*") {
      source += "[^/]*";
    } else if (char === "?") {
      source += "[^/]";
    } else {
      source += char.replace(/[.+^${}()|[\]\\]/g, "\\$&");
    }
  }
  return new RegExp(`^${source}$`);
}

function prefixesOf(path) {
  const parts = path.split("/");
  return parts.map((_, index) => parts.slice(0, index + 1).join("/"));
}

function matchesPattern(relativePath, pattern) {
  const anchored = pattern.includes("/");
  const clean = pattern.replace(/^\//, "").replace(/\/$/, "");
  const regex = globToRegex(clean);

  if (anchored) {
    return prefixesOf(relativePath).some((prefix) => regex.test(prefix));
  }
  return relativePath.split("/").some((segment) => regex.test(segment));
}

export async function loadIgnorePatterns(root) {
  const patterns = [...DEFAULT_IGNORES];
  try {
    const text = await readFile(join(root, ".gitignore"), "utf8");
    for (const raw of text.split(/\r?\n/)) {
      const line = raw.trim();
      if (line === "" || line.startsWith("#") || line.startsWith("!")) continue;
      patterns.push(line);
    }
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  return patterns;
}

export function isIgnored(relativePath, patterns) {
  const rel = normalizePath(relativePath);
  return patterns.some((pattern) => matchesPattern(rel, pattern));
}