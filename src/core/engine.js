import { readFile } from "node:fs/promises";
import { extname } from "node:path";
import { parse } from "espree";
import { rules } from "../../rules/index.js";

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

function lineStartsOf(source) {
  const starts = [0];
  for (let index = 0; index < source.length; index += 1) {
    if (source[index] === "\n") starts.push(index + 1);
  }
  return starts;
}

function positionAt(starts, offset) {
  let low = 0;
  let high = starts.length - 1;

  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    if (starts[middle] <= offset) {
      low = middle;
    } else {
      high = middle - 1;
    }
  }

  return { line: low + 1, column: offset - starts[low] + 1 };
}

function withLocation(issue, source, starts) {
  if (typeof issue.start !== "number") {
    return {
      ...issue,
      line: issue.line ?? 1,
      column: issue.column ?? 1,
    };
  }

  const start = positionAt(starts, issue.start);
  const end = positionAt(starts, Math.max(issue.end ?? issue.start, issue.start));
  const lineStart = starts[start.line - 1];
  const lineEnd = source.indexOf("\n", lineStart);
  const snippet = source
    .slice(lineStart, lineEnd === -1 ? source.length : lineEnd)
    .replace(/\r$/, "");

  return {
    ...issue,
    line: start.line,
    column: start.column,
    endLine: end.line,
    endColumn: end.column,
    snippet,
  };
}

export async function runRules(files, { disabledRules = new Set() } = {}) {
  const issues = [];
  const activeRules = rules.filter((rule) => !disabledRules.has(rule.name));

  for (const file of files) {
    const source = await readFile(file, "utf8");
    const extension = extname(file).toLowerCase();
    const starts = lineStartsOf(source);

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
        issues.push(
          withLocation(
            {
              rule: "parser",
              file,
              line: error.lineNumber ?? 1,
              message: `Unable to parse file: ${error.message}`,
            },
            source,
            starts
          )
        );
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
        issues.push(
          withLocation(
            {
              rule: rule.name,
              file,
              ...issue,
            },
            source,
            starts
          )
        );
      }
    }
  }

  return issues;
}