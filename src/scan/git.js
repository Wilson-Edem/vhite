import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { resolve } from "node:path";

const run = promisify(execFile);

async function git(root, args) {
  try {
    const { stdout } = await run("git", args, { cwd: root });
    return stdout.split(/\r?\n/).filter((line) => line.trim() !== "");
  } catch (error) {
    throw new Error(
      "This option needs a Git repository with at least one commit, and Git must be installed"
    );
  }
}

export async function changedFiles(root, mode) {
  let names;
  if (mode === "staged") {
    names = await git(root, ["diff", "--name-only", "--relative", "--cached"]);
  } else {
    const tracked = await git(root, ["diff", "--name-only", "--relative", "HEAD"]);
    const untracked = await git(root, ["ls-files", "--others", "--exclude-standard"]);
    names = [...tracked, ...untracked];
  }
  return new Set(names.map((name) => resolve(root, name)));
}