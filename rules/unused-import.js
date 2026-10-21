import { analyze } from "eslint-scope";

const unusedImport = {
  name: "unused-import",
  description: "Flags imported bindings that are never read",
  extensions: [".js", ".jsx", ".mjs", ".cjs"],
  requiresAst: true,
  check({ ast }) {
    const issues = [];

    let scopeManager;
    try {
      scopeManager = analyze(ast, {
        ecmaVersion: 2022,
        sourceType: "module",
        optimistic: true,
        ignoreEval: true,
      });
    } catch {
      // If scope analysis cannot handle a file, avoid reporting unreliable results.
      return issues;
    }

    for (const scope of scopeManager.scopes) {
      for (const variable of scope.variables) {
        const isImport = variable.defs?.some((definition) => definition.type === "ImportBinding");
        if (!isImport) continue;

        const hasRead = variable.references.some((reference) => reference.isRead());
        if (!hasRead) {
          const definition = variable.defs.find((item) => item.type === "ImportBinding");
          issues.push({
            line: definition?.name?.loc?.start.line ?? variable.identifiers[0]?.loc?.start.line ?? 1,
            message: `Imported binding "${variable.name}" is never used`,
          });
        }
      }
    }

    return issues;
  },
};

export default unusedImport;
