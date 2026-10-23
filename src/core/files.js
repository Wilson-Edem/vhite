import { readdir } from "node:fs/promises";
import { join, extname } from "node:path";

const IGNORED = new Set(["node_modules", ".git", "dist", "build"]);
const EXTENSIONS = new Set([".js", ".jsx", ".mjs", ".cjs", ".html", ".css"]);

export async function findFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (IGNORED.has(entry.name)) continue;
      files.push(...(await findFiles(join(dir, entry.name))));
    } else if (EXTENSIONS.has(extname(entry.name))) {
      files.push(join(dir, entry.name));
    }
  }

  return files;
}