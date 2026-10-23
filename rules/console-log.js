const consoleLog = {
  name: "console-log",
  description: "Flags console.log calls that may have been left during debugging",
  extensions: [".js", ".jsx", ".mjs", ".cjs"],
  requiresAst: true,
  check({ ast }) {
    const issues = [];

    function visit(node) {
      if (!node || typeof node !== "object") return;

      if (
        node.type === "CallExpression" &&
        node.callee?.type === "MemberExpression" &&
        !node.callee.computed &&
        node.callee.object?.type === "Identifier" &&
        node.callee.object.name === "console" &&
        node.callee.property?.type === "Identifier" &&
        node.callee.property.name === "log"
      ) {
        issues.push({
                    start: node.range?.[0],
          end: node.range?.[1],
          message: "Review or remove this console.log call",
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

export default consoleLog;
