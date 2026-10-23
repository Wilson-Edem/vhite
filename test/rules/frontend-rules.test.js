import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runRules } from "../../src/core/engine.js";

async function rulesFor(source, rule) {
  const root = await mkdtemp(join(tmpdir(), "vhite-fe-"));
  const file = join(root, "component.jsx");
  await writeFile(file, source, "utf8");
  try {
    const issues = await runRules([file], {});
    return issues.filter((issue) => issue.rule === rule).map((issue) => issue.line);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

test("react-missing-key flags map items without a key", async () => {
  const bad = "const x = items.map((item) => <li>{item}</li>);\n";
  const good = "const x = items.map((item) => <li key={item.id}>{item}</li>);\n";
  const spread = "const x = items.map((item) => <li {...item}>{item}</li>);\n";
  assert.deepEqual(await rulesFor(bad, "react-missing-key"), [1]);
  assert.deepEqual(await rulesFor(good, "react-missing-key"), []);
  assert.deepEqual(await rulesFor(spread, "react-missing-key"), []);
});

test("react-missing-key also checks block-bodied map callbacks", async () => {
  const source = "const x = items.map((item) => {\n  return <li>{item}</li>;\n});\n";
  assert.deepEqual(await rulesFor(source, "react-missing-key"), [2]);
});

test("react-dangerous-html flags dangerouslySetInnerHTML", async () => {
  const source = "const x = <div dangerouslySetInnerHTML={{ __html: html }} />;\n";
  assert.deepEqual(await rulesFor(source, "react-dangerous-html"), [1]);
});

test("a11y-img-alt flags images without alt text", async () => {
  assert.deepEqual(await rulesFor("const x = <img src=\"a.png\" />;\n", "a11y-img-alt"), [1]);
  assert.deepEqual(await rulesFor("const x = <img src=\"a.png\" alt=\"\" />;\n", "a11y-img-alt"), []);
});

test("a11y-input-label accepts labelled inputs and skips buttons", async () => {
  assert.deepEqual(await rulesFor("const x = <input type=\"text\" />;\n", "a11y-input-label"), [1]);
  assert.deepEqual(await rulesFor("const x = <input aria-label=\"Name\" />;\n", "a11y-input-label"), []);
  assert.deepEqual(await rulesFor("const x = <input type=\"hidden\" />;\n", "a11y-input-label"), []);
  assert.deepEqual(await rulesFor("const x = <input type=\"submit\" />;\n", "a11y-input-label"), []);
});

test("a11y-click-div flags clickable divs without a role", async () => {
  assert.deepEqual(await rulesFor("const x = <div onClick={go} />;\n", "a11y-click-div"), [1]);
  assert.deepEqual(await rulesFor("const x = <div role=\"button\" onClick={go} />;\n", "a11y-click-div"), []);
  assert.deepEqual(await rulesFor("const x = <div />;\n", "a11y-click-div"), []);
});