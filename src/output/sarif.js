import { relative, sep } from "node:path";
import { rules } from "../../rules/index.js";

const LEVELS = { error: "error", warning: "warning", info: "note" };

function toPosix(path) {
  return path.split(sep).join("/");
}

export function formatSarif({ root, issues, version }) {
  const descriptions = new Map(rules.map((rule) => [rule.name, rule.description]));
  const ruleIds = [...new Set(issues.map((issue) => issue.rule))].sort();

  const results = issues.map((issue) => {
    const column = issue.column ?? 1;
    return {
      ruleId: issue.rule,
      level: LEVELS[issue.severity] ?? "warning",
      message: { text: issue.message },
      locations: [
        {
          physicalLocation: {
            artifactLocation: { uri: toPosix(relative(root, issue.file)) },
            region: {
              startLine: issue.line,
              startColumn: column,
              endLine: issue.endLine ?? issue.line,
              endColumn: issue.endColumn ?? column,
            },
          },
        },
      ],
    };
  });

  return JSON.stringify(
    {
      $schema: "https://json.schemastore.org/sarif-2.1.0.json",
      version: "2.1.0",
      runs: [
        {
          tool: {
            driver: {
              name: "vhite",
              version,
              informationUri: "https://github.com/Wilson-Edem/vhite",
              rules: ruleIds.map((id) => ({
                id,
                shortDescription: { text: descriptions.get(id) ?? id },
              })),
            },
          },
          results,
        },
      ],
    },
    null,
    2
  );
}