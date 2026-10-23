import { test } from "node:test";
import assert from "node:assert/strict";
import { formatSarif } from "../../src/output/sarif.js";

test("SARIF output has the required structure and severity levels", () => {
  const sarif = JSON.parse(
    formatSarif({
      root: "/project",
      version: "0.6.0",
      issues: [
        { rule: "console-log", severity: "warning", file: "/project/src/a.js", line: 3, column: 5, endLine: 3, endColumn: 15, message: "m" },
        { rule: "leftover-todo", severity: "info", file: "/project/b.js", line: 1, column: 1, endLine: 1, endColumn: 10, message: "n" },
      ],
    })
  );
  assert.equal(sarif.version, "2.1.0");
  const run = sarif.runs[0];
  assert.equal(run.tool.driver.name, "vhite");
  assert.equal(run.results.length, 2);
  assert.equal(run.results[0].level, "warning");
  assert.equal(run.results[1].level, "note");
  const location = run.results[0].locations[0].physicalLocation;
  assert.equal(location.region.startLine, 3);
  assert.equal(location.artifactLocation.uri, "src/a.js");
  assert.ok(run.tool.driver.rules.some((rule) => rule.id === "console-log"));
});