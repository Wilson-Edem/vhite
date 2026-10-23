import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const here = fileURLToPath(new URL("../", import.meta.url));
const cliPath = resolve(here, "../bin/cli.js");

async function makeProject(files) {
  const root = await mkdtemp(join(tmpdir(), "vhite-cli-test-"));
  for (const [name, contents] of Object.entries(files)) {
    const path = join(root, name);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, contents, "utf8");
  }
  return root;
}

function runCli(root) {
  return spawnSync(process.execPath, [cliPath, root], {
    encoding: "utf8",
    env: { ...process.env, CI: "1" },
  });
}

async function withProject(files, callback) {
  const root = await makeProject(files);
  try {
    await callback(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

test("CLI scans the supplied directory and prints the report", async () => {
  await withProject({ "app.js": 'console.log("hello");\n' }, (root) => {
    const result = runCli(root);
    assert.equal(result.status, 1, result.stderr);
    assert.match(result.stdout, /vhite found 1 front-end files/);
    assert.match(result.stdout, /console-log/);
    assert.match(result.stdout, /1 issue\(s\) in 1 file\(s\)/);
  });
});

test("CLI respects rules disabled in vhite.config.json", async () => {
  await withProject({
    "app.js": 'console.log("hello");\n',
    "vhite.config.json": JSON.stringify({ disabledRules: ["console-log"] }),
  }, (root) => {
    const result = runCli(root);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Rules turned off: console-log/);
    assert.match(result.stdout, /No issues found\./);
  });
});

test("CLI reports invalid configuration and exits with an error", async () => {
  await withProject({
    "app.js": 'console.log("hello");\n',
    "vhite.config.json": "{ invalid json",
  }, (root) => {
    const result = runCli(root);
    assert.equal(result.status, 2);
    assert.match(result.stderr, /Error: vhite\.config\.json is not valid JSON/);
  });
});

test("CLI skips interactive setup in non-interactive environments", async () => {
  await withProject({ "app.js": "const value = 1;\n" }, (root) => {
    const result = runCli(root);
    assert.equal(result.status, 0, result.stderr);
    assert.doesNotMatch(result.stdout, /Choose which rules to turn off/);
    assert.match(result.stdout, /No issues found\./);
  });
});