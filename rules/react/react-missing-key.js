import { childNodes, attributeNamed, hasSpread } from "../shared/jsx-helpers.js";

function returnedJsx(fn) {
  if (fn.body.type === "JSXElement") return fn.body;
  if (fn.body.type !== "BlockStatement") return null;

  for (const statement of fn.body.body) {
    if (statement.type === "ReturnStatement" && statement.argument?.type === "JSXElement") {
      return statement.argument;
    }
  }
  return null;
}

const reactMissingKey = {
  name: "react-missing-key",
  description: "Flags list items created inside a .map() call without a key prop",
  extensions: [".js", ".jsx", ".mjs", ".cjs"],
  requiresAst: true,
  check({ ast }) {
    const issues = [];

    function visit(node) {
      if (!node || typeof node !== "object") return;

      const callback = node.arguments?.[0];
      if (
        node.type === "CallExpression" &&
        node.callee?.type === "MemberExpression" &&
        node.callee.property?.name === "map" &&
        callback &&
        ["ArrowFunctionExpression", "FunctionExpression"].includes(callback.type)
      ) {
        const element = returnedJsx(callback);
        if (
          element &&
          !hasSpread(element.openingElement) &&
          !attributeNamed(element.openingElement, "key")
        ) {
          issues.push({
            start: element.range?.[0],
            end: element.range?.[1],
            message: "List item needs a unique key prop so React can track it",
          });
        }
      }

      for (const child of childNodes(node)) visit(child);
    }

    visit(ast);
    return issues;
  },
};

export default reactMissingKey;