import { test } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { runRules } from "../../src/core/engine.js";

const here = fileURLToPath(new URL("../", import.meta.url));
const fixture = (name) => join(here, "fixtures", name);

async function linesFor(name, rule) {
  const issues = await runRules([fixture(name)]);
  return issues.filter((issue) => issue.rule === rule).map((issue) => issue.line);
}

test("debugger-statement flags a real debugger statement only", async () => {
  assert.deepEqual(await linesFor("debugger.js", "debugger-statement"), [3]);
});

test("console-log flags console.log but not console.error or property lookalikes", async () => {
  assert.deepEqual(await linesFor("console.js", "console-log"), [1]);
});

test("empty-catch flags an empty catch body", async () => {
  assert.deepEqual(await linesFor("empty-catch.js", "empty-catch"), [3]);
});

test("unused-import flags only the binding that is never used", async () => {
  assert.deepEqual(await linesFor("unused-import.js", "unused-import"), [2]);
});

test("unused-import does not flag components used only in JSX", async () => {
  assert.deepEqual(await linesFor("jsx-import.jsx", "unused-import"), []);
});

test("leftover-todo flags comments but not strings", async () => {
  assert.deepEqual(await linesFor("todo.js", "leftover-todo"), [2]);
});

test("empty-block flags empty if/else blocks but not function or loop bodies", async () => {
  assert.deepEqual(await linesFor("empty-block.js", "empty-block"), [3]);
});

test("hardcoded-secret flags credential assignments and token formats only", async () => {
  assert.deepEqual(await linesFor("secret.js", "hardcoded-secret"), [1, 3]);
});

test("clean files produce no issues", async () => {
  assert.deepEqual(await runRules([fixture("clean.js")]), []);
});

test("unparseable files produce a parser issue instead of crashing", async () => {
  const issues = await runRules([fixture("broken.js")]);
  const parserIssues = issues.filter((issue) => issue.rule === "parser");
  assert.equal(parserIssues.length, 1);
  assert.equal(parserIssues[0].line, 1);
});