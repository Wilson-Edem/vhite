const commentFixer = {
  rule: "leftover-todo",
  apply(source, issue) {
    const { type, value, range } = issue.comment ?? {};
    if (!range) return null;

    const [start, end] = range;
    const expected = type === "Line" ? `//${value}` : `/*${value}*/`;
    if (source.slice(start, end) !== expected) return null;

    const lineStart = source.lastIndexOf("\n", start - 1) + 1;
    const newlineAfter = source.indexOf("\n", end);
    const lineEnd = newlineAfter === -1 ? source.length : newlineAfter;
    const before = source.slice(lineStart, start);
    const after = source.slice(end, lineEnd);

    if (before.trim() === "" && after.trim() === "") {
      const removeTo = newlineAfter === -1 ? source.length : newlineAfter + 1;
      return source.slice(0, lineStart) + source.slice(removeTo);
    }

    const head = source.slice(0, start).replace(/[ \t]+$/, "");
    if (after.trim() === "") {
      return head + source.slice(lineEnd);
    }

    const rest = source.slice(end).replace(/^[ \t]+/, "");
    return before.trim() === "" ? head + rest : `${head} ${rest}`;
  },
};

export default commentFixer;