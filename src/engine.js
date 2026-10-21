import { readFile } from "node:fs/promises";
import { extname } from "node:path";
import { parse } from "espree";
import { rules } from "../rules/index.js";

function parseSource(source, file) {
  const extension = extname(file).toLowerCase();

  return parse(source, {
    ecmaVersion: "latest",
    sourceType: extension === ".cjs" ? "commonjs" : "module",
    ecmaFeatures: {
      jsx: true,
    },
    loc: true,
    range: true,
    comment: true,
    tokens: true,
    allowHashBang: true,
  });
}

export async function runRules(files, { disabledRules = new Set() } = {}) {
  const issues = [];
  const activeRules = rules.filter((rule) => !disabledRules.has(rule.name));

  for (const file of files) {
    const source = await readFile(file, "utf8");
    const extension = extname(file).toLowerCase();

    const applicableRules = activeRules.filter((rule) =>
      rule.extensions?.includes(extension)
    );

    if (applicableRules.length === 0) {
      continue;
    }

    const needsAst = applicableRules.some(
      (rule) => rule.requiresAst === true
    );

    let ast;

    if (needsAst) {
      try {
        ast = parseSource(source, file);
      } catch (error) {
        issues.push({
          rule: "parser",
          file,
          line: error.lineNumber ?? 1,
          message: `Unable to parse file: ${error.message}`,
        });
      }
    }

    for (const rule of applicableRules) {
      if (rule.requiresAst === true && !ast) {
        continue;
      }

      const found = rule.check({
        file,
        source,
        ...(rule.requiresAst === true ? { ast } : {}),
      });

      for (const issue of found) {
        issues.push({
          rule: rule.name,
          file,
          ...issue,
        });
      }
    }
  }

  return issues;
}