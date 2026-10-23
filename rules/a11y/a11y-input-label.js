import { childNodes, attributeNamed, hasSpread, literalValue } from "../shared/jsx-helpers.js";

const NO_LABEL_TYPES = new Set(["hidden", "submit", "button", "reset", "image"]);
const LABEL_ATTRIBUTES = ["aria-label", "aria-labelledby", "id", "title"];

const a11yInputLabel = {
  name: "a11y-input-label",
  description: "Flags form inputs with no label or accessible name attribute",
  extensions: [".js", ".jsx", ".mjs", ".cjs"],
  requiresAst: true,
  check({ ast }) {
    const issues = [];

    function visit(node) {
      if (!node || typeof node !== "object") return;

      if (
        node.type === "JSXOpeningElement" &&
        node.name?.type === "JSXIdentifier" &&
        node.name.name === "input" &&
        !hasSpread(node) &&
        !NO_LABEL_TYPES.has(literalValue(attributeNamed(node, "type"))) &&
        !LABEL_ATTRIBUTES.some((name) => attributeNamed(node, name))
      ) {
        issues.push({
          start: node.range?.[0],
          end: node.range?.[1],
          message: "Form input has no label; connect it to a label element, or add aria-label",
        });
      }

      for (const child of childNodes(node)) visit(child);
    }

    visit(ast);
    return issues;
  },
};

export default a11yInputLabel;