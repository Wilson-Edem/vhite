import { childNodes, attributeNamed, hasSpread } from "../shared/jsx-helpers.js";

const CLICKABLE_TAGS = new Set(["div", "span"]);

const a11yClickDiv = {
  name: "a11y-click-div",
  description: "Flags clickable div or span elements that have no role",
  extensions: [".js", ".jsx", ".mjs", ".cjs"],
  requiresAst: true,
  check({ ast }) {
    const issues = [];

    function visit(node) {
      if (!node || typeof node !== "object") return;

      if (
        node.type === "JSXOpeningElement" &&
        node.name?.type === "JSXIdentifier" &&
        CLICKABLE_TAGS.has(node.name.name) &&
        attributeNamed(node, "onClick") &&
        !attributeNamed(node, "role") &&
        !hasSpread(node)
      ) {
        issues.push({
          start: node.range?.[0],
          end: node.range?.[1],
          message: `Clickable <${node.name.name}> is not reachable by keyboard or announced to screen readers; use a button, or add role and keyboard handling`,
        });
      }

      for (const child of childNodes(node)) visit(child);
    }

    visit(ast);
    return issues;
  },
};

export default a11yClickDiv;