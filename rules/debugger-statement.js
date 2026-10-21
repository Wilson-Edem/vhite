const debuggerStatement = {
  name: "debugger-statement",
  description: "Flags debugger statements left in source code",
  extensions: [".js", ".jsx", ".mjs", ".cjs"],
  requiresAst: true,
  check({ ast }) {
    const issues = [];

    function visit(node) {
      if (!node || typeof node !== "object") return;

      if (node.type === "DebuggerStatement") {
        issues.push({
          line: node.loc?.start.line ?? 1,
          message: "Remove the debugger statement before shipping",
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

export default debuggerStatement;
