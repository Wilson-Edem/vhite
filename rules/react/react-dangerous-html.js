import { childNodes } from "../shared/jsx-helpers.js";

const reactDangerousHtml = {
  name: "react-dangerous-html",
  description: "Flags uses of dangerouslySetInnerHTML, which can allow script injection",
  extensions: [".js", ".jsx", ".mjs", ".cjs"],
  requiresAst: true,
  check({ ast }) {
    const issues = [];

    function visit(node) {
      if (!node || typeof node !== "object") return;

      if (node.type === "JSXAttribute" && node.name?.name === "dangerouslySetInnerHTML") {
        issues.push({
          start: node.range?.[0],
          end: node.range?.[1],
          message: "dangerouslySetInnerHTML can run injected scripts; render normal JSX or sanitize the HTML first",
        });
      }

      for (const child of childNodes(node)) visit(child);
    }

    visit(ast);
    return issues;
  },
};

export default reactDangerousHtml;