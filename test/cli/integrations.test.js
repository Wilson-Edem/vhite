import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, readFile, rm, access } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { spawnSync, spawn, execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const here = fileURLToPath(new URL("../", import.meta.url));
const cliPath = resolve(here, "../bin/cli.js");

async function project(files, { git = false } = {}) {
  const root = await mkdtemp(join(tmpdir(), "vhite-060-"));
  for (const [name, contents] of Object.entries(files)) {
    const path = join(root, name);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, contents, "utf8");
  }
  if (git) execFileSync("git", ["init", "-q"], { cwd: root, stdio: "ignore" });
  return root;
}

function cli(args) {
  return spawnSync(process.execPath, [cliPath, ...args], {
    encoding: "utf8",
    env: { ...process.env, CI: "1" },
  });
}

function waitFor(predicate, timeoutMs = 15000) {
  return new Promise((done, fail) => {
    const started = Date.now();
    const timer = setInterval(() => {
      if (predicate()) {
        clearInterval(timer);
        done();
      } else if (Date.now() - started > timeoutMs) {
        clearInterval(timer);
        fail(new Error("timed out"));
      }
    }, 50);
  });
}

test("--format sarif prints a SARIF report with the findings", async () => {
  const root = await project({ "app.js": 'console.log("hi");\n' });
  try {
    const result = cli([root, "--format", "sarif"]);
    assert.equal(result.status, 1, result.stderr);
    const sarif = JSON.parse(result.stdout);
    assert.equal(sarif.version, "2.1.0");
    assert.ok(sarif.runs[0].results.some((item) => item.ruleId === "console-log"));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("hook install, reinstall, and remove work inside a Git repository", async () => {
  const root = await project({}, { git: true });
  const hookPath = join(root, ".git", "hooks", "pre-commit");
  try {
    assert.equal(cli(["hook", "install", root]).status, 0);
    assert.match(await readFile(hookPath, "utf8"), /vhite-pre-commit-hook/);

    assert.equal(cli(["hook", "install", root]).status, 0);
    assert.equal(cli(["hook", "remove", root]).status, 0);
    await assert.rejects(access(hookPath));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("hook install refuses to overwrite a hook vhite did not create", async () => {
  const root = await project({}, { git: true });
  const hookPath = join(root, ".git", "hooks", "pre-commit");
  try {
    await mkdir(join(root, ".git", "hooks"), { recursive: true });
    await writeFile(hookPath, "#!/bin/sh\necho custom\n", "utf8");

    const refused = cli(["hook", "install", root]);
    assert.equal(refused.status, 2);
    assert.match(await readFile(hookPath, "utf8"), /echo custom/);

    assert.equal(cli(["hook", "install", root, "--force"]).status, 0);
    assert.match(await readFile(hookPath, "utf8"), /vhite-pre-commit-hook/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("hook install outside a Git repository exits with an error", async () => {
  const root = await project({ "app.js": "const a = 1;\n" });
  try {
    const result = cli(["hook", "install", root]);
    assert.equal(result.status, 2);
    assert.match(result.stderr, /not a Git repository/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("--watch rescans when a file changes", async () => {
  const root = await project({ "app.js": "const a = 1;\n" });
  const child = spawn(process.execPath, [cliPath, root, "--watch"], {
    env: { ...process.env, CI: "1" },
  });
  let output = "";
  child.stdout.on("data", (chunk) => {
    output += chunk;
  });
  child.stderr.on("data", (chunk) => {
    output += chunk;
  });
  try {
    await waitFor(() => output.includes("Watching for changes"));
    await writeFile(join(root, "app.js"), 'console.log("changed");\n', "utf8");
    await waitFor(() => (output.match(/Vhite run completed\./g) ?? []).length >= 2);
    assert.match(output, /console-log/);
  } finally {
    child.kill();
    await rm(root, { recursive: true, force: true });
  }
});