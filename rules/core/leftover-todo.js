const todoPattern = /\b(TODO|FIXME)\b/;

const leftoverTodo = {
  name: "leftover-todo",
  description: "Flags comments left in code, with TODO and FIXME notes called out separately",
  extensions: [".js", ".jsx", ".mjs", ".cjs"],
  requiresAst: true,
  check({ ast, source }) {
    const issues = [];
    for (const comment of ast.comments ?? []) {
      if (comment.range?.[0] === 0 && source?.startsWith("#!")) continue;
      if (comment.value.includes("vhite-disable")) continue;

      const isTodo = todoPattern.test(comment.value);
      issues.push({
        start: comment.range?.[0],
        end: comment.range?.[1],
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