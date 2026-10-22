const todoPattern = /\b(TODO|FIXME)\b/;

const leftoverTodo = {
  name: "leftover-todo",
  description: "Flags comments left in code, with TODO and FIXME notes called out separately",
  extensions: [".js", ".jsx", ".mjs", ".cjs"],
  requiresAst: true,
  check({ ast }) {
    const issues = [];
    for (const comment of ast.comments ?? []) {
      const isTodo = todoPattern.test(comment.value);
      issues.push({
        line: comment.loc.start.line,
        message: isTodo ? "Leftover TODO or FIXME note" : "Code comment left in the file",
        comment: {
          type: comment.type,
          value: comment.value,
          range: comment.range,
        },
      });
    }
    return issues;
  },
};

export default leftoverTodo;