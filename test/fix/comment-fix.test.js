import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runRules } from "../../src/core/engine.js";
import { proposeFixes, applyApprovedFixes } from "../../src/fix/safe-fix.js";
import { fixers } from "../../src/fix/fixers/index.js";

const sample = "// header\nconst a = 1; // trailing\n/* block */\nconst b = 2;\n";

test("every comment is flagged, with TODO notes worded separately", async () => {
  const root = await mkdtemp(join(tmpdir(), "vhite-comment-"));
  const file = join(root, "c.js");
  await writeFile(file, "// TODO: later\n// plain note\nconst x = 1;\n");
  const issues = await runRules([file], {});
  const messages = issues.filter((i) => i.rule === "leftover-todo").map((i) => i.message);
  assert.deepEqual(messages, ["Leftover TODO or FIXME note", "Code comment left in the file"]);
});

test("applying the comment fix removes all comments and keeps code", async () => {
  const root = await mkdtemp(join(tmpdir(), "vhite-comment-"));
  const file = join(root, "c.js");
  await writeFile(file, sample);
  const proposals = await proposeFixes(await runRules([file], {}));
  const { results } = await applyApprovedFixes(root, proposals);
  assert.ok(results.every((r) => r.status === "applied"));
  assert.equal(await readFile(file, "utf8"), "const a = 1;\nconst b = 2;\n");
});

test("the comment fix skips when the text no longer matches the scan", () => {
  const issue = { line: 1, comment: { type: "Line", value: " old", range: [0, 6] } };
  assert.equal(fixers["leftover-todo"].apply("// new\nx();\n", issue), null);
});