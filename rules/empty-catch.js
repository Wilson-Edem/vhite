const emptyCatch = {
  name: "empty-catch",
  description: "Flags catch clauses that silently ignore errors",
  extensions: [".js", ".jsx", ".mjs", ".cjs"],
  requiresAst: true,
  check({ ast }) {
    const issues = [];

    function visit(node) {
      if (!node || typeof node !== "object") return;

      if (
        node.type === "CatchClause" &&
        node.body?.type === "BlockStatement" &&
        node.body.body.length === 0
      ) {
        issues.push({
          line: node.loc?.start.line ?? 1,
          message: "Handle, log, or explicitly document this caught error",
        });
      }

      for (const value of Object.values(node)) {
        if (Array.isArray(value)) {
          for (const child of value) {
            if (child && typeof child.type === "string") visit(child);
          }
        } else if (value && typeof value.type === "string") {
          visit(value);
        }
      }
    }

    visit(ast);
    return issues;
  },
};

export default emptyCatch;
