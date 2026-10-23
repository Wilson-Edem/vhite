import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runRules } from "../src/engine.js";
import { formatReport } from "../src/reporter.js";

async function scan(name, source) {
  const root = await mkdtemp(join(tmpdir(), "vhite-loc-"));
  const file = join(root, name);
  await writeFile(file, source, "utf8");
  try {
    return { root, issues: await runRules([file], {}) };
  } catch (error) {
    await rm(root, { recursive: true, force: true });
    throw error;
  }
}

async function cleanup(root) {
  await rm(root, { recursive: true, force: true });
}

test("console-log reports the column and span of the call", async () => {
  const { root, issues } = await scan("a.js", '  console.log("x");\n');
  try {
    const issue = issues.find((item) => item.rule === "console-log");
    assert.equal(issue.line, 1);
    assert.equal(issue.column, 3);
    assert.equal(issue.endColumn, 19);
    assert.equal(issue.snippet, '  console.log("x");');
  } finally {
    await cleanup(root);
  }
});

test("debugger-statement points at the keyword on the right line", async () => {
  const { root, issues } = await scan("b.js", "const a = 1;\n  debugger;\n");
  try {
    const issue = issues.find((item) => item.rule === "debugger-statement");
    assert.equal(issue.line, 2);
    assert.equal(issue.column, 3);
  } finally {
    await cleanup(root);
  }
});

test("unused-import points at the binding name", async () => {
  const { root, issues } = await scan("c.js", 'import { unused } from "./u.js";\n');
  try {
    const issue = issues.find((item) => item.rule === "unused-import");
    assert.equal(issue.line, 1);
    assert.equal(issue.column, 10);
    assert.equal(issue.endColumn, 16);
  } finally {
    await cleanup(root);
  }
});

test("hardcoded-secret points at the match inside a line", async () => {
  const { root, issues } = await scan("d.js", 'const x = 1;\nconst password = "supersecret123";\n');
  try {
    const issue = issues.find((item) => item.rule === "hardcoded-secret");
    assert.equal(issue.line, 2);
    assert.equal(issue.column, 7);
  } finally {
    await cleanup(root);
  }
});

test("leftover-todo points at the comment start", async () => {
  const { root, issues } = await scan("e.js", "const a = 1;\n  // TODO later\n");
  try {
    const issue = issues.find((item) => item.rule === "leftover-todo");
    assert.equal(issue.line, 2);
    assert.equal(issue.column, 3);
  } finally {
    await cleanup(root);
  }
});

test("reports show a snippet and caret under the problem", async () => {
  const { root, issues } = await scan("f.js", "debugger;\n");
  try {
    const report = formatReport(issues, root);
    assert.match(report, /1 \| debugger;/);
    assert.match(report, /\| \^{9}/);
  } finally {
    await cleanup(root);
  }
});

test("parser failures still report a line without a snippet", async () => {
  const { root, issues } = await scan("g.js", "const = ;\n");
  try {
    const issue = issues.find((item) => item.rule === "parser");
    assert.equal(issue.line, 1);
    assert.equal(issue.column, 1);
    assert.equal(issue.snippet, undefined);
  } finally {
    await cleanup(root);
  }
});