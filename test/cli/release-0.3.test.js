import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { spawnSync, execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { parseArgs, UsageError } from "../../src/core/args.js";
import { loadIgnorePatterns, isIgnored } from "../../src/scan/ignore.js";
import { runRules } from "../../src/core/engine.js";
import { applySuppressions } from "../../src/scan/suppress.js";
import { buildBaseline, applyBaseline, fingerprintOf } from "../../src/scan/baseline.js";
import { changedFiles } from "../../src/scan/git.js";
import { loadConfig } from "../../src/core/config.js";

const here = fileURLToPath(new URL("../", import.meta.url));
const cliPath = resolve(here, "../bin/cli.js");

async function project(files) {
  const root = await mkdtemp(join(tmpdir(), "vhite-030-"));
  for (const [name, contents] of Object.entries(files)) {
    const path = join(root, name);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, contents, "utf8");
  }
  return root;
}

function cli(args, cwd) {
  return spawnSync(process.execPath, [cliPath, ...args], {
    encoding: "utf8",
    cwd,
    env: { ...process.env, CI: "1" },
  });
}

test("default ignores and .gitignore patterns are applied", async () => {
  const root = await project({
    ".gitignore": "*.log\nbuild/\n# comment\n\nsrc/gen\n",
  });
  try {
    const patterns = await loadIgnorePatterns(root);
    assert.equal(isIgnored("node_modules/pkg/index.js", patterns), true);
    assert.equal(isIgnored("notes.log", patterns), true);
    assert.equal(isIgnored("build/out.js", patterns), true);
    assert.equal(isIgnored("src/gen/code.js", patterns), true);
    assert.equal(isIgnored("src/app.js", patterns), false);
    assert.equal(isIgnored("src/generated.js", patterns), false);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("next-line and same-line directives hide only the named rule", async () => {
  const source = [
    "// vhite-disable-next-line console-log",
    'console.log("a");',
    'console.log("b"); // vhite-disable-line console-log',
    'console.log("c");',
    "// vhite-disable-next-line debugger-statement",
    'console.log("d");',
    "",
  ].join("\n");
  const root = await project({ "app.js": source });
  try {
    const file = join(root, "app.js");
    const issues = await runRules([file], {});
    const result = await applySuppressions(issues, root);
    const lines = result.issues.filter((i) => i.rule === "console-log").map((i) => i.line);
    assert.deepEqual(lines, [4, 6]);
    assert.equal(result.suppressed, 2);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("suppression comments are not reported by leftover-todo", async () => {
  const root = await project({
    "app.js": "// vhite-disable-next-line console-log\nconsole.log(1);\n",
  });
  try {
    const issues = await runRules([join(root, "app.js")], {});
    assert.equal(issues.filter((i) => i.rule === "leftover-todo").length, 0);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("baseline hides old problems even after their lines move", async () => {
  const root = await project({ "app.js": 'console.log("old");\n' });
  try {
    const file = join(root, "app.js");
    const baseline = buildBaseline(await runRules([file], {}), root);

    await writeFile(file, '\n\nconsole.log("old");\nconsole.log("new");\n', "utf8");
    const issues = await runRules([file], {});
    const applied = applyBaseline(issues, baseline, root);

    assert.equal(applied.hidden, 1);
    assert.equal(applied.issues.length, 1);
    assert.equal(applied.issues[0].line, 4);
    assert.match(fingerprintOf(issues[0], root), /console-log\|app\.js\|/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("--changed and --staged cannot be used together", () => {
  assert.throws(() => parseArgs(["--changed", "--staged"]), UsageError);
});

test("changedFiles reports modified and new files, and staged reports only staged ones", async () => {
  const root = await project({ "a.js": "const a = 1;\n", "keep.js": "const k = 1;\n" });
  const git = (args) =>
    execFileSync("git", args, {
      cwd: root,
      stdio: "ignore",
      env: { ...process.env, GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@t", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@t" },
    });
  try {
    git(["init", "-q"]);
    git(["add", "-A"]);
    git(["commit", "-q", "-m", "init"]);

    await writeFile(join(root, "a.js"), "const a = 2;\n", "utf8");
    await writeFile(join(root, "new.js"), "const n = 1;\n", "utf8");

    const changed = await changedFiles(root, "changed");
    assert.equal(changed.has(join(root, "a.js")), true);
    assert.equal(changed.has(join(root, "new.js")), true);
    assert.equal(changed.has(join(root, "keep.js")), false);

    git(["add", "a.js"]);
    const staged = await changedFiles(root, "staged");
    assert.equal(staged.has(join(root, "a.js")), true);
    assert.equal(staged.has(join(root, "new.js")), false);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("CLI baseline then scan reports only new problems", async () => {
  const root = await project({ "app.js": 'console.log("old");\n' });
  try {
    const saved = cli(["baseline", root], root);
    assert.equal(saved.status, 0, saved.stderr);

    const clean = cli([root, "--format", "json"], root);
    assert.equal(clean.status, 0, clean.stderr);
    assert.equal(JSON.parse(clean.stdout).summary.total, 0);

    await writeFile(join(root, "app.js"), 'console.log("old");\nconsole.log("new");\n', "utf8");
    const fresh = cli([root, "--format", "json"], root);
    assert.equal(fresh.status, 1, fresh.stderr);
    assert.equal(JSON.parse(fresh.stdout).summary.total, 1);

    const ignored = cli([root, "--format", "json", "--no-baseline"], root);
    assert.equal(JSON.parse(ignored.stdout).summary.total, 2);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("config still loads for the new release", async () => {
  const root = await project({ "vhite.config.json": "{}" });
  try {
    const config = await loadConfig(root);
    assert.equal(config.disabledRules.size, 0);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("CLI --changed without Git exits with an error", async () => {
  const root = await project({ "app.js": "const a = 1;\n" });
  try {
    const result = cli([root, "--changed"], root);
    assert.equal(result.status, 2);
    assert.match(result.stderr, /Git repository/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});