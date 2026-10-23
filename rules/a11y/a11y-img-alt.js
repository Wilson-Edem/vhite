import { childNodes, attributeNamed, hasSpread } from "../shared/jsx-helpers.js";

const a11yImgAlt = {
  name: "a11y-img-alt",
  description: "Flags images that have no alt attribute",
  extensions: [".js", ".jsx", ".mjs", ".cjs"],
  requiresAst: true,
  check({ ast }) {
    const issues = [];

    function visit(node) {
      if (!node || typeof node !== "object") return;

      if (
        node.type === "JSXOpeningElement" &&
        node.name?.type === "JSXIdentifier" &&
        node.name.name === "img" &&
        !hasSpread(node) &&
        !attributeNamed(node, "alt")
      ) {
        issues.push({
          start: node.range?.[0],
          end: node.range?.[1],
          message: "Image has no alt attribute; add a description, or alt=\"\" if it is decorative",
        });
      }

      for (const child of childNodes(node)) visit(child);
    }

    visit(ast);
    return issues;
  },
};

export default a11yImgAlt;