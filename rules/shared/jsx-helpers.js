export const SKIP_KEYS = new Set(["loc", "range", "tokens", "comments", "parent"]);

export function childNodes(node) {
  const children = [];
  for (const [key, value] of Object.entries(node)) {
    if (SKIP_KEYS.has(key)) continue;
    if (Array.isArray(value)) {
      for (const child of value) {
        if (child && typeof child.type === "string") children.push(child);
      }
    } else if (value && typeof value.type === "string") {
      children.push(value);
    }
  }
  return children;
}

export function attributeNamed(element, name) {
  return element.attributes.find(
    (attr) => attr.type === "JSXAttribute" && attr.name?.name === name
  );
}

export function hasSpread(element) {
  return element.attributes.some((attr) => attr.type === "JSXSpreadAttribute");
}

export function literalValue(attribute) {
  return attribute?.value?.type === "Literal" ? attribute.value.value : null;
}