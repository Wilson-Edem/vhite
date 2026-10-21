const leftoverTodo = {
  name: "leftover-todo",
  description: "Flags TODO and FIXME notes left in comments",
  extensions: [".js", ".jsx", ".mjs", ".cjs"],
  requiresAst: true,
  check({ ast }) {
    const issues = [];
    for (const comment of ast.comments ?? []) {
      if (/\b(TODO|FIXME)\b/.test(comment.value)) {
        issues.push({ line: comment.loc.start.line, message: "Leftover TODO or FIXME note" });
      }
    }
    return issues;
  },
};

export default leftoverTodo;