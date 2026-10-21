import { test } from "node:test";
import assert from "node:assert/strict";
import { formatReport } from "../src/reporter.js";

const root = "/project";

test("reporter displays a clean result when there are no issues", () => {
  assert.equal(formatReport([], root), "No issues found.");
});

test("reporter groups issues by file and sorts each file by line number", () => {
  const report = formatReport([
    { file: "/project/src/a.js", line: 9, message: "Later issue", rule: "console-log" },
    { file: "/project/src/b.js", line: 2, message: "Other file issue", rule: "debugger-statement" },
    { file: "/project/src/a.js", line: 3, message: "Earlier issue", rule: "debugger-statement" },
  ], root);

  assert.ok(report.indexOf("src/a.js") < report.indexOf("src/b.js"));
  assert.ok(report.indexOf("Line 3: Earlier issue") < report.indexOf("Line 9: Later issue"));
  assert.match(report, /3 issue\(s\) in 2 file\(s\)/);
});

test("reporter includes explanations when a rule has one", () => {
  const report = formatReport([
    { file: "/project/app.js", line: 1, message: "Debugger statement", rule: "debugger-statement" },
  ], root);

  assert.match(report, /What happened:/);
  assert.match(report, /Proposed change:/);
  assert.match(report, /1 issue\(s\) in 1 file\(s\)/);
});

test("reporter still displays issues without a registered explanation", () => {
  const report = formatReport([
    { file: "/project/app.js", line: 4, message: "Unknown diagnostic", rule: "unknown-rule" },
  ], root);

  assert.match(report, /Line 4: Unknown diagnostic \[unknown-rule\]/);
  assert.match(report, /1 issue\(s\) in 1 file\(s\)/);
});
