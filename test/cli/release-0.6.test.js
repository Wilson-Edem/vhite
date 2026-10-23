import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { parseArgs } from "../../src/core/args.js";

const here = fileURLToPath(new URL("../", import.meta.url));
const cliPath = resolve(here, "../bin/cli.js");

function cli(args, cwd) {
  return spawnSync(process.execPath, [cliPath, ...args], {
    encoding: "utf8",
    cwd,
    env: { ...process.env, CI: "1" },
  });
}

async function project(files) {
  const root = await mkdtemp(join(tmpdir(), "vhite-060-"));
  for (const [name, contents] of Object.entries(files)) {
    const path = join(root, name);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, contents, "utf8");
  }
  return root;
}

test("--no-prompt is parsed", () => {
  assert.equal(parseArgs(["--no-prompt"]).noPrompt, true);
  assert.equal(parseArgs([]).noPrompt, false);
});

test("SARIF output has the expected structure and levels", async () => {
  const root = await project({ "app.js": "debugger;\nconsole.log(1);\n" });
  try {
    const result = cli([root, "--format", "sarif"], root);
    const sarif = JSON.parse(result.stdout);
    assert.equal(sarif.version, "2.1.0");
    const results = sarif.runs[0].results;
    assert.ok(results.length >= 2);
    const debuggerResult = results.find((r) => r.ruleId === "debugger-statement");
    assert.equal(debuggerResult.level, "error");
    const region = debuggerResult.locations[0].physicalLocation.region;
    assert.equal(region.startLine, 1);
    assert.equal(region.startColumn, 1);
    assert.equal(
      debuggerResult.locations[0].physicalLocation.artifactLocation.uri,
      "app.js"
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("hook install writes a script, refuses to replace a foreign hook, and removes only its own", async () => {
  const root = await project({ "app.js": "const a = 1;\n" });
  try {
    const init = spawnSync("git", ["init", "-q"], { cwd: root });
    if (init.status !== 0) return;

    const hookPath = join(root, ".git", "hooks", "pre-commit");

    const installed = cli(["hook", "install", root], root);
    assert.equal(installed.status, 0, installed.stderr);
    const script = await readFile(hookPath, "utf8");
    assert.match(script, /vhite-pre-commit-hook/);
    assert.match(script, /--staged --no-prompt/);

    const again = cli(["hook", "install", root], root);
    assert.equal(again.status, 0, again.stderr);

    const removed = cli(["hook", "remove", root], root);
    assert.equal(removed.status, 0, removed.stderr);

    await writeFile(hookPath, "#!/bin/sh\necho mine\n", "utf8");
    const refused = cli(["hook", "install", root], root);
    assert.equal(refused.status, 2);
    assert.match(refused.stderr, /already exists/);
    assert.match(await readFile(hookPath, "utf8"), /echo mine/);

    const other = cli(["hook", "remove", root], root);
    assert.equal(other.status, 2);
    assert.match(await readFile(hookPath, "utf8"), /echo mine/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});