const emptyBlock = {
  name: "empty-block",
  description: "Flags empty control-flow blocks that may hide unfinished logic",
  extensions: [".js", ".jsx", ".mjs", ".cjs"],
  requiresAst: true,
  check({ ast }) {
    const issues = [];

    function visit(node, parent = null, key = null) {
      if (!node || typeof node !== "object") return;

      if (
        node.type === "BlockStatement" &&
        node.body.length === 0 &&
        parent?.type !== "CatchClause" &&
        key !== "body"
      ) {
        issues.push({
          line: node.loc?.start.line ?? 1,
          message: "Review this empty block; it may indicate missing logic",
        });
      }

      for (const [childKey, value] of Object.entries(node)) {
        if (Array.isArray(value)) {
          for (const child of value) {
            if (child && typeof child.type === "string") visit(child, node, childKey);
          }
        } else if (value && typeof value.type === "string") {
          visit(value, node, childKey);
        }
      }
    }

    visit(ast);
    return issues;
  },
};

export default emptyBlock;
