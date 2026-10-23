import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { parseArgs, UsageError, isIncluded } from "../src/args.js";
import { decideExitCode, EXIT } from "../src/exit-codes.js";
import { formatJson } from "../src/json-output.js";
import { loadConfig, severityOf } from "../src/config.js";

const here = dirname(fileURLToPath(import.meta.url));
const cliPath = resolve(here, "../bin/cli.js");

function run(args) {
  return spawnSync(process.execPath, [cliPath, ...args], {
    encoding: "utf8",
    env: { ...process.env, CI: "1" },
  });
}

async function project(files) {
  const root = await mkdtemp(join(tmpdir(), "vhite-opts-"));
  for (const [name, contents] of Object.entries(files)) {
    const path = join(root, name);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, contents, "utf8");
  }
  return root;
}

test("parseArgs defaults to scanning the current folder", () => {
  const options = parseArgs([]);
  assert.equal(options.command, "scan");
  assert.equal(options.path, ".");
  assert.equal(options.format, "text");
});

test("parseArgs treats a bare path as a scan", () => {
  const options = parseArgs(["./my-app"]);
  assert.equal(options.command, "scan");
  assert.equal(options.path, "./my-app");
});

test("parseArgs reads commands and repeatable flags", () => {
  const options = parseArgs([
    "fix", "app", "--rule", "console-log", "--rule", "debugger-statement",
    "--disable", "leftover-todo", "--exclude", "dist", "--format", "json", "-q",
  ]);
  assert.equal(options.command, "fix");
  assert.deepEqual(options.rules, ["console-log", "debugger-statement"]);
  assert.deepEqual(options.disable, ["leftover-todo"]);
  assert.deepEqual(options.exclude, ["dist"]);
  assert.equal(options.format, "json");
  assert.equal(options.quiet, true);
});

test("parseArgs rejects unknown options, bad formats, and missing values", () => {
  assert.throws(() => parseArgs(["--nope"]), UsageError);
  assert.throws(() => parseArgs(["--format", "xml"]), UsageError);
  assert.throws(() => parseArgs(["--rule"]), UsageError);
  assert.throws(() => parseArgs(["explain"]), UsageError);
});

test("isIncluded applies include and exclude by folder prefix", () => {
  assert.equal(isIncluded("src/app.js", ["src"], []), true);
  assert.equal(isIncluded("lib/app.js", ["src"], []), false);
  assert.equal(isIncluded("src/gen/x.js", [], ["src/gen"]), false);
  assert.equal(isIncluded("srcx/a.js", ["src"], []), false);
  assert.equal(isIncluded("anything.js", [], []), true);
});

test("decideExitCode follows the documented precedence", () => {
  assert.equal(decideExitCode({}), EXIT.CLEAN);
  assert.equal(decideExitCode({ issues: 2 }), EXIT.ISSUES);
  assert.equal(decideExitCode({ applied: 1 }), EXIT.FIXED);
  assert.equal(decideExitCode({ applied: 1, issues: 1 }), EXIT.ISSUES);
  assert.equal(decideExitCode({ rolledBack: 1, issues: 1 }), EXIT.ROLLED_BACK);
  assert.equal(decideExitCode({ failed: true, rolledBack: 1 }), EXIT.ERROR);
});

test("config severities and off values are read correctly", async () => {
  const root = await project({
    "vhite.config.json": JSON.stringify({
      rules: {
        "console-log": "error",
        "leftover-todo": { severity: "warning" },
        "empty-block": "off",
        "not-a-rule": "warning",
        "debugger-statement": "loud",
      },
    }),
  });
  try {
    const config = await loadConfig(root);
    assert.equal(severityOf("console-log", config), "error");
    assert.equal(severityOf("leftover-todo", config), "warning");
    assert.equal(config.disabledRules.has("empty-block"), true);
    assert.equal(severityOf("debugger-statement", config), "error");
    assert.equal(config.warnings.length, 2);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("formatJson produces a summary and relative file paths", () => {
  const root = "/project";
  const json = JSON.parse(
    formatJson({
      root,
      filesScanned: 2,
      version: "0.2.0",
      issues: [
        { rule: "console-log", severity: "warning", file: "/project/src/a.js", line: 4, message: "m" },
        { rule: "debugger-statement", severity: "error", file: "/project/b.js", line: 1, message: "n" },
      ],
    })
  );
  assert.equal(json.summary.total, 2);
  assert.equal(json.summary.error, 1);
  assert.equal(json.summary.warning, 1);
  assert.equal(json.issues[0].file, "b.js");
  assert.equal(json.issues[1].file, "src/a.js");
});

test("CLI --format json prints only parseable JSON", async () => {
  const root = await project({ "app.js": 'console.log("hi");\n' });
  try {
    const result = run([root, "--format", "json"]);
    assert.equal(result.status, 1, result.stderr);
    const data = JSON.parse(result.stdout);
    assert.equal(data.summary.warning, 1);
    assert.equal(data.issues[0].rule, "console-log");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("info-only findings do not fail the run", async () => {
  const root = await project({ "app.js": "// a plain note\nconst x = 1;\n" });
  try {
    const result = run([root]);
    assert.equal(result.status, 0, result.stderr);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("CLI --rule runs only the named rule", async () => {
  const root = await project({ "app.js": 'console.log("hi");\ndebugger;\n' });
  try {
    const result = run([root, "--rule", "debugger-statement", "--format", "json"]);
    const data = JSON.parse(result.stdout);
    assert.deepEqual(data.issues.map((issue) => issue.rule), ["debugger-statement"]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("CLI --exclude skips matching folders", async () => {
  const root = await project({
    "src/app.js": 'console.log("hi");\n',
    "dist/bundle.js": 'console.log("hi");\n',
  });
  try {
    const result = run([root, "--exclude", "dist", "--format", "json"]);
    const data = JSON.parse(result.stdout);
    assert.equal(data.filesScanned, 1);
    assert.equal(data.issues.length, 1);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("CLI fix without a terminal and without --fix exits with an error", async () => {
  const root = await project({ "app.js": "debugger;\n" });
  try {
    const result = run(["fix", root]);
    assert.equal(result.status, 2);
    assert.match(result.stderr, /needs an interactive terminal/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("CLI --fix applies safe fixes, rescans, and exits 3", async () => {
  const root = await project({ "app.js": "const a = 1;\ndebugger;\n" });
  try {
    const result = run(["fix", root, "--fix"]);
    assert.equal(result.status, 3, result.stderr);
    assert.equal(await readFile(join(root, "app.js"), "utf8"), "const a = 1;\n");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("CLI version, rules, and explain commands work", () => {
  const version = run(["version"]);
  assert.equal(version.status, 0);
  assert.match(version.stdout, /^\d+\.\d+\.\d+/);

  const rules = run(["rules"]);
  assert.equal(rules.status, 0);
  assert.match(rules.stdout, /console-log/);

  const explain = run(["explain", "console-log"]);
  assert.equal(explain.status, 0);
  assert.match(explain.stdout, /Default severity: warning/);

  const unknown = run(["explain", "nope"]);
  assert.equal(unknown.status, 2);
});