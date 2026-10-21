const leftoverTodo = {
  name: "leftover-todo",
  description: "Flags TODO and FIXME notes left in the code",
  extensions: [".js", ".jsx", ".mjs", ".cjs", ".html", ".css"],
  check({ source }) {
    const issues = [];
    source.split("\n").forEach((text, index) => {
      if (/\b(TODO|FIXME)\b/.test(text)) {
        issues.push({
          line: index + 1,
          message: "Leftover TODO or FIXME note",
        });
      }
    });
    return issues;
  },
};

export default leftoverTodo;
