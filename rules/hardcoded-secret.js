const SECRET_PATTERNS = [
  {
    pattern: /\b(?:api[_-]?key|access[_-]?token|auth[_-]?token|client[_-]?secret|secret[_-]?key|password)\b\s*[:=]\s*["'`][^"'`\s]{8,}["'`]/i,
    label: "credential-like value",
  },
  {
    pattern: /\b(?:sk-[A-Za-z0-9_-]{16,}|gh[pousr]_[A-Za-z0-9_]{20,}|AKIA[0-9A-Z]{16})\b/,
    label: "token-like value",
  },
];

const hardcodedSecret = {
  name: "hardcoded-secret",
  description: "Heuristically flags possible hardcoded credentials or API tokens",
  extensions: [".js", ".jsx", ".mjs", ".cjs", ".html", ".css"],
  check({ source }) {
    const issues = [];
    const lines = source.split("\n");

    lines.forEach((text, index) => {
      for (const item of SECRET_PATTERNS) {
        if (item.pattern.test(text)) {
          issues.push({
            line: index + 1,
            message: `Possible hardcoded secret (${item.label}); move it to a secure environment variable and rotate it if real`,
          });
          break;
        }
      }
    });

    return issues;
  },
};

export default hardcodedSecret;
