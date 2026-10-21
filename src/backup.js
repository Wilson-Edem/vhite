import { mkdir, copyFile, rm } from "node:fs/promises";
import {
  join,
  relative,
  dirname,
  isAbsolute,
} from "node:path";
import {
  FIX_DIR,
  ensureGitignoreEntry,
} from "./gitignore.js";

export async function prepareBackupDir(root) {
  const changed = await ensureGitignoreEntry(root);
  const dir = join(root, FIX_DIR, "backup");

  await mkdir(dir, { recursive: true });

  return { dir, changed };
}

function backupPathFor(root, file, attempt) {
  const rel = relative(root, file);

  if (rel.startsWith("..") || isAbsolute(rel)) {
    throw new Error(
      `Refusing to back up a file outside the project: ${file}`
    );
  }

  return join(
    root,
    FIX_DIR,
    "backup",
    `${rel}.${attempt}.bak`
  );
}

export async function saveBackup(root, file, attempt) {
  const dest = backupPathFor(root, file, attempt);

  await mkdir(dirname(dest), { recursive: true });
  await copyFile(file, dest);

  return dest;
}

export async function restoreBackup(file, backupPath) {
  await copyFile(backupPath, file);
}

/**
 * Deletes only backups explicitly recorded in the results
 * for this run. It does not delete older backup files.
 */
export async function deleteRunBackups(results) {
  const paths = [
    ...new Set(
      results
        .map((result) => result.backupPath)
        .filter((backupPath) => typeof backupPath === "string")
    ),
  ];

  let deleted = 0;

  for (const backupPath of paths) {
    await rm(backupPath, { force: true });
    deleted += 1;
  }

  return { deleted, paths };
}
