import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { groupByFile, validateEdits, toProposals, aiFixerFor, proposeAiFixes } from "../../src/ai/fix.js";
import { readAiFixSetting, saveAiFixSetting } from "../../src/ai/consent.js";

const finding = (overrides) => ({
  file: "/p/a.js",
  rule: "console-log",
  message: "Review",
  line: 2,
  severity: "warning",
  ...overrides,
});

test("groupByFile keeps errors and warnings and drops info", () => {
  const issues = [
    finding({ severity: "error" }),
    finding({ line: 3, severity: "warning" }),
    finding({ line: 4, severity: "info" }),
  ];
  const groups = groupByFile(issues);
  assert.equal(groups.get("/p/a.js").length, 2);
});

test("validateEdits accepts only edits that match the current line", () => {
  const text = "const a = 1;\nconsole.log(a);\n";
  const findings = [finding({ line: 2 })];
  const accepted = validateEdits(
    [
      { line: 2, original: "console.log(a);", replacement: "" },
      { line: 1, original: "const a = 1;", replacement: "const a = 2;" },
      { line: 2, original: "wrong text", replacement: "x" },
    ],
    text,
    findings
  );
  assert.equal(accepted.length, 1);
  assert.equal(accepted[0].line, 2);
});

test("validateEdits rejects multi-line replacements and no-op changes", () => {
  const text = "console.log(a);\n";
  const findings = [finding({ line: 1 })];
  assert.equal(
    validateEdits([{ line: 1, original: "console.log(a);", replacement: "a();\nb();" }], text, findings).length,
    0
  );
  assert.equal(
    validateEdits([{ line: 1, original: "console.log(a);", replacement: "console.log(a);" }], text, findings).length,
    0
  );
});

test("aiFixerFor applies a replacement or deletes the line", () => {
  const fixer = aiFixerFor("console-log");
  const source = "const a = 1;\nconsole.log(a);\nconst b = 2;\n";
  assert.equal(
    fixer.apply(source, { line: 2, original: "console.log(a);", replacement: "" }),
    "const a = 1;\nconst b = 2;\n"
  );
  assert.equal(
    fixer.apply(source, { line: 2, original: "console.log(a);", replacement: "// removed" }),
    "const a = 1;\n// removed\nconst b = 2;\n"
  );
  assert.equal(fixer.apply(source, { line: 2, original: "not here", replacement: "" }), null);
});

test("proposeAiFixes skips files with secrets and sends only clean code", async () => {
  const root = await mkdtemp(join(tmpdir(), "vhite-aifix-"));
  try {
    const secretFile = join(root, "secret.js");
    const cleanFile = join(root, "clean.js");
    await writeFile(secretFile, 'const password = "supersecret123";\nconsole.log(1);\n', "utf8");
    await writeFile(cleanFile, "const a = 1;\nconsole.log(a);\n", "utf8");

    const sent = [];
    const fakeFetch = async (_url, options) => {
      sent.push(JSON.parse(options.body));
      return {
        ok: true,
        status: 200,
        json: async () => ({ edits: [{ line: 2, original: "console.log(a);", replacement: "" }] }),
      };
    };

    const messages = [];
    const issues = [
      { file: secretFile, rule: "console-log", message: "Review", line: 2, severity: "warning" },
      { file: cleanFile, rule: "console-log", message: "Review", line: 2, severity: "warning" },
    ];
    const proposals = await proposeAiFixes(issues, (m) => messages.push(m), {
      endpoint: "https://example.test/fix",
      fetchImpl: fakeFetch,
    });

    assert.equal(sent.length, 1);
    assert.equal(sent.length, 1);
    assert.equal(proposals.length, 1);
    assert.equal(proposals[0].aiFix, true);
    assert.equal(proposals[0].replacement, "");
    assert.ok(messages.some((m) => m.includes("secret-looking value")));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("proposeAiFixes stops when the daily limit is reached", async () => {
  const root = await mkdtemp(join(tmpdir(), "vhite-aifix-"));
  try {
    const file = join(root, "a.js");
    await writeFile(file, "console.log(1);\n", "utf8");
    const messages = [];
    const proposals = await proposeAiFixes(
      [{ file, rule: "console-log", message: "m", line: 1, severity: "warning" }],
      (m) => messages.push(m),
      {
        endpoint: "https://example.test/fix",
        fetchImpl: async () => ({ ok: false, status: 429, json: async () => ({}) }),
      }
    );
    assert.equal(proposals.length, 0);
    assert.ok(messages.some((m) => m.includes("limit reached")));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("the AI fix setting is saved and read back without losing other config", async () => {
  const root = await mkdtemp(join(tmpdir(), "vhite-consent-"));
  try {
    await writeFile(join(root, "vhite.config.json"), JSON.stringify({ disabledRules: ["console-log"] }), "utf8");
    assert.equal(await readAiFixSetting(root), undefined);
    await saveAiFixSetting(root, false);
    assert.equal(await readAiFixSetting(root), false);
    const saved = JSON.parse(await readFile(join(root, "vhite.config.json"), "utf8"));
    assert.deepEqual(saved.disabledRules, ["console-log"]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("toProposals marks every proposal as an AI fix", () => {
  const proposals = toProposals("/p/a.js", [
    { line: 2, original: "console.log(a);", replacement: "", finding: finding({ line: 2 }) },
  ]);
  assert.equal(proposals[0].aiFix, true);
  assert.equal(proposals[0].rule, "console-log");
});
