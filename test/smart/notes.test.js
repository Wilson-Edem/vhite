import { test } from "node:test";
import assert from "node:assert/strict";
import { redact, contextFor, noteIssue, noteAll } from "../../src/smart/notes.js";
import { parseArgs } from "../../src/core/args.js";

test("redact removes credential-looking values and tokens", () => {
  const text = 'const password = "supersecret123";\nconst t = "sk-abcdefghijklmnop1234";';
  const output = redact(text);
  assert.equal(output.includes("supersecret123"), false);
  assert.equal(output.includes("sk-abcdefghijklmnop1234"), false);
  assert.match(output, /\[REDACTED\]/);
});

test("contextFor returns five lines before and after the finding", () => {
  const source = Array.from({ length: 20 }, (_, i) => `line ${i + 1}`).join("\n");
  const snippet = contextFor(source, 10).split("\n");
  assert.equal(snippet[0], "line 5");
  assert.equal(snippet[snippet.length - 1], "line 15");
  assert.equal(snippet.length, 11);
});

test("noteIssue sends only the rule, message, and redacted snippet", async () => {
  let sent = null;
  const fakeFetch = async (_url, options) => {
    sent = JSON.parse(options.body);
    return { ok: true, status: 200, json: async () => ({ explanation: "Because.", remaining: 19 }) };
  };
  const source = 'const apiKey = "abcd1234efgh5678";\nconsole.log(1);\n';
  const result = await noteIssue(
    { rule: "console-log", message: "Review", line: 2 },
    source,
    { endpoint: "https://example.test/api", fetchImpl: fakeFetch }
  );
  assert.equal(result.text, "Because.");
  assert.equal(sent.rule, "console-log");
  assert.equal(sent.snippet.includes("abcd1234efgh5678"), false);
  assert.equal(Object.keys(sent).sort().join(","), "language,message,rule,snippet");
});

test("noteIssue reports the daily limit", async () => {
  const fakeFetch = async () => ({ ok: false, status: 429, json: async () => ({}) });
  const result = await noteIssue(
    { rule: "console-log", message: "m", line: 1 },
    "console.log(1);",
    { endpoint: "https://example.test/api", fetchImpl: fakeFetch }
  );
  assert.equal(result.limited, true);
});

test("noteAll writes each explanation through the say function", async () => {
  const lines = [];
  const fakeFetch = async () => ({ ok: true, status: 200, json: async () => ({ explanation: "Note.", remaining: 1 }) });
  const issues = [{ rule: "debugger-statement", message: "m", line: 1, file: import.meta.filename }];
  const count = await noteAll(issues, (line) => lines.push(line), { fetchImpl: fakeFetch, endpoint: "https://example.test/api" });
  assert.equal(count, 1);
  assert.match(lines[0], /Smart note for line 1/);
});

test("--smart-notes turns on smart notes without asking", () => {
  assert.equal(parseArgs(["--smart-notes"]).smartNotes, true);
  assert.equal(parseArgs([]).smartNotes, false);
});