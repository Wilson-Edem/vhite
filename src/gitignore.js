import {
  readFile,
  writeFile,
} from "node:fs/promises";
import { join } from "node:path";

export const FIX_DIR = ".vhite-fix";

export async function ensureGitignoreEntry(root) {
  const path = join(root, ".gitignore");
  const entry = `${FIX_DIR}/`;

  let text = "";

  try {
    text = await readFile(path, "utf8");
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw error;
    }
  }

  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim());

  if (lines.includes(entry) || lines.includes(FIX_DIR)) {
    return false;
  }

  const separator =
    text === "" || text.endsWith("\n")
      ? ""
      : "\n";

  await writeFile(
    path,
    `${text}${separator}${entry}\n`,
    "utf8"
  );

  return true;
}
