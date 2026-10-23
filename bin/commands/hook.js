import { readFile, writeFile, rm, mkdir, chmod, stat } from "node:fs/promises";
import { join, resolve } from "node:path";
import { EXIT } from "../../src/core/exit-codes.js";

const MARKER = "# vhite-pre-commit-hook";
const HOOK_SCRIPT = `#!/bin/sh
${MARKER}
# Scans staged files before each commit. Remove with: vhite hook remove
npx --yes @vhite/vhite --staged --no-prompt
`;

async function gitDirFor(root) {
  try {
    const info = await stat(join(root, ".git"));
    return info.isDirectory() ? join(root, ".git") : null;
  } catch {
    return null;
  }
}

export async function runHook(options) {
  const root = resolve(options.path ?? ".");
  const gitDir = await gitDirFor(root);

  if (!gitDir) {
    console.error("Error: this folder is not a Git repository (no .git folder found)");
    return EXIT.ERROR;
  }

  const hookPath = join(gitDir, "hooks", "pre-commit");
  const existing = await readFile(hookPath, "utf8").catch(() => null);
  const isOurs = existing !== null && existing.includes(MARKER);

  if (options.hookAction === "install") {
    if (existing !== null && !isOurs && !options.force) {
      console.error("Error: a pre-commit hook already exists. Use --force to replace it.");
      return EXIT.ERROR;
    }
    await mkdir(join(gitDir, "hooks"), { recursive: true });
    await writeFile(hookPath, HOOK_SCRIPT, "utf8");
    await chmod(hookPath, 0o755).catch(() => {});
    console.log(`Installed pre-commit hook at ${hookPath}`);
    return EXIT.CLEAN;
  }

  if (existing === null) {
    console.log("No pre-commit hook to remove.");
    return EXIT.CLEAN;
  }
  if (!isOurs) {
    console.error("Error: the existing pre-commit hook was not installed by vhite, so it was left alone.");
    return EXIT.ERROR;
  }

  await rm(hookPath);
  console.log("Removed the vhite pre-commit hook.");
  return EXIT.CLEAN;
}