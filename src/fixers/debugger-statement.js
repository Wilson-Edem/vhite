const debuggerFixer = {
  rule: "debugger-statement",
  apply(source, issue) {
    const lines = source.split("\n");
    const index = issue.line - 1;
    if (!/^\s*debugger\s*;?\s*$/.test(lines[index] ?? "")) return null;
    lines.splice(index, 1);
    return lines.join("\n");
  },
};

export default debuggerFixer;