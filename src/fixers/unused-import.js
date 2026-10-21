const unusedImportFixer = {
  rule: "unused-import",
  apply(source, issue) {
    const name = issue.message.match(/"([^"]+)"/)?.[1];
    if (!name) return null;
    const escaped = name.replace(/\$/g, "\\$");
    const lines = source.split("\n");
    const index = issue.line - 1;
    const single = new RegExp(
      `^\\s*import\\s+(?:${escaped}|\\{\\s*${escaped}\\s*\\})\\s+from\\s+["'][^"']+["'];?\\s*$`
    );
    if (!single.test(lines[index] ?? "")) return null;
    lines.splice(index, 1);
    return lines.join("\n");
  },
};

export default unusedImportFixer;