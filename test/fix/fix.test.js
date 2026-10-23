import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, readFile, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runRules } from "../../src/core/engine.js";
import { proposeFixes, applyApprovedFixes } from "../../src/fix/safe-fix.js";
import { ensureGitignoreEntry } from "../../src/fix/gitignore.js";
import { fixers } from "../../src/fix/fixers/index.js";

async function makeProject(files) {
  const root = await mkdtemp(join(tmpdir(), "vhite-fix-test-"));
  for (const [name, text] of Object.entries(files)) {
    await writeFile(join(root, name), text, "utf8");
  }
  return root;
}

test("debugger fixer removes a standalone debugger line only", () => {
  const source = "const a = 1;\ndebugger;\nconst b = 2;\n";
  const issue = { line: 2, message: "Remove the debugger statement before shipping" };
  assert.equal(fixers["debugger-statement"].apply(source, issue), "const a = 1;\nconst b = 2;\n");

  const shared = "const a = 1; debugger;\n";
  assert.equal(fixers["debugger-statement"].apply(shared, { line: 1, message: "" }), null);
});

test("unused-import fixer removes a single-binding import and skips multi-binding imports", () => {
  const single = 'import x from "./x.js";\nconst y = 1;\n';
  const issue = { line: 1, message: 'Imported binding "x" is never used' };
  assert.equal(fixers["unused-import"].apply(single, issue), "const y = 1;\n");

  const multi = 'import { x, z } from "./x.js";\nconst y = 1;\n';
  assert.equal(fixers["unused-import"].apply(multi, issue), null);
});

test("proposing fixes never modifies the original file", async () => {
  const root = await makeProject({ "a.js": 'import u from "./u.js";\ndebugger;\n' });
  const file = join(root, "a.js");
  const original = await readFile(file, "utf8");
  const proposals = await proposeFixes(await runRules([file]));
  assert.equal(proposals.length, 2);
  assert.equal(await readFile(file, "utf8"), original);
});

test("approved fixes are written to the original and leave other lines alone", async () => {
  const root = await makeProject({ "a.js": 'import u from "./u.js";\nconst keep = 1;\ndebugger;\n' });
  const file = join(root, "a.js");
  const proposals = await proposeFixes(await runRules([file]));
  const { results, gitignoreUpdated } = await applyApprovedFixes(root, proposals);

  assert.ok(results.every((result) => result.status === "applied"));
  assert.equal(await readFile(file, "utf8"), "const keep = 1;\n");
  assert.equal(gitignoreUpdated, true);
  assert.equal((await readdir(join(root, ".vhite-fix", "backup"))).length, 2);
});

test("a fix that produces broken code is rolled back to the original", async () => {
  const root = await makeProject({ "a.js": "debugger;\nconst keep = 1;\n" });
  const file = join(root, "a.js");
  const brokenFixers = {
    "debugger-statement": {
      rule: "debugger-statement",
      apply: () => "const = ;\n",
    },
  };
  const proposals = await proposeFixes(await runRules([file]));
  const { results } = await applyApprovedFixes(root, proposals, { fixers: brokenFixers });

  assert.equal(results[0].status, "rolled back");
  assert.equal(await readFile(file, "utf8"), "debugger;\nconst keep = 1;\n");
});

test("the .vhite-fix entry is added to .gitignore once and only once", async () => {
  const root = await makeProject({ ".gitignore": "node_modules" });
  assert.equal(await ensureGitignoreEntry(root), true);
  assert.equal(await ensureGitignoreEntry(root), false);
  const text = await readFile(join(root, ".gitignore"), "utf8");
  assert.equal(text, "node_modules\n.vhite-fix/\n");
});