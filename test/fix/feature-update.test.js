import { test } from "node:test";
import assert from "node:assert/strict";

import {
  mkdtemp,
  writeFile,
  readFile,
  mkdir,
  rm,
} from "node:fs/promises";

import { tmpdir } from "node:os";
import { join } from "node:path";

import { deleteRunBackups } from "../../src/fix/backup.js";

import {
  formatMarkdownRunReport,
  writeRunReport,
} from "../../src/output/run-report.js";

async function makeProject() {
  return mkdtemp(join(tmpdir(), "vhite-feature-test-"));
}

test(
  "backup cleanup deletes only explicitly listed current-run backups",
  async () => {
    const root = await makeProject();

    try {
      const backupDir = join(root, ".vhite-fix", "backup");
      await mkdir(backupDir, { recursive: true });

      const currentBackup = join(backupDir, "app.js.1.bak");
      const olderBackup = join(backupDir, "app.js.older.bak");

      await writeFile(currentBackup, "current backup");
      await writeFile(olderBackup, "older backup");

      const result = await deleteRunBackups([
        { backupPath: currentBackup },
      ]);

      assert.equal(result.deleted, 1);
      assert.deepEqual(result.paths, [currentBackup]);

      // Ensure current backup file is removed.
      await assert.rejects(
        readFile(currentBackup, "utf8"),
        { code: "ENOENT" }
      );

      // Ensure older backup remains untouched.
      const olderContent = await readFile(olderBackup, "utf8");
      assert.equal(olderContent, "older backup");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  }
);

test(
  "Markdown run report generation formats correctly and updates gitignore",
  async () => {
    const root = await makeProject();

    try {
      const result = await writeRunReport({
        root,
        target: root,
        startedAt: new Date(),
        finishedAt: new Date(),
        filesScanned: 5,
        issues: [],
        proposals: [],
        fixResults: [],
        logs: ["Starting run...", "Completed."],
        backupCleanup: {
          requested: false,
          deleted: 0,
        },
      });

      assert.match(
        result.reportPath,
        /\.vhite-fix[/\\]reports[/\\]vhite-report-.*\.md$/
      );

      const reportContent = await readFile(result.reportPath, "utf8");
      assert.match(reportContent, /No issues were detected/);

      const gitignore = await readFile(join(root, ".gitignore"), "utf8");
      assert.match(gitignore, /\.vhite-fix\//);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  }
);
