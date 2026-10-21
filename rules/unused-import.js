import { analyze } from "eslint-scope";

const unusedImport = {
  name: "unused-import",
  description: "Flags imported bindings that are never read",
  extensions: [".js", ".jsx", ".mjs", ".cjs"],
  requiresAst: true,
  check({ ast }) {
    const issues = [];
    const jsxNames = new Set();
    let hasJsx = false;

    function collectJsx(node) {
      if (!node || typeof node !== "object") return;
      if (node.type === "JSXIdentifier") jsxNames.add(node.name);
      if (node.type === "JSXOpeningElement" || node.type === "JSXFragment") hasJsx = true;

      for (const [key, value] of Object.entries(node)) {
        if (["loc", "range", "tokens", "comments"].includes(key)) continue;
        if (Array.isArray(value)) {
          for (const child of value) {
            if (child && typeof child.type === "string") collectJsx(child);
          }
        } else if (value && typeof value.type === "string") {
          collectJsx(value);
        }
      }
    }

    collectJsx(ast);

    let scopeManager;
    try {
      scopeManager = analyze(ast, {
        ecmaVersion: 2022,
        sourceType: "module",
        optimistic: true,
        ignoreEval: true,
      });
    } catch {
      return issues;
    }

    for (const scope of scopeManager.scopes) {
      for (const variable of scope.variables) {
        const isImport = variable.defs?.some((definition) => definition.type === "ImportBinding");
        if (!isImport) continue;

        const hasRead = variable.references.some((reference) => reference.isRead());
        const usedInJsx = jsxNames.has(variable.name);
        const implicitReact = variable.name === "React" && hasJsx;

        if (!hasRead && !usedInJsx && !implicitReact) {
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