export const COMMANDS = ["scan", "fix", "rules", "explain", "version", "help"];

const FORMATS = ["text", "json"];
const VALUE_FLAGS = new Set(["--format", "--rule", "--disable", "--include", "--exclude"]);

export class UsageError extends Error {}

export function parseArgs(argv) {
  const args = [...argv];
  const options = {
    command: "scan",
    positionals: [],
    format: "text",
    quiet: false,
    fix: false,
    rules: [],
    disable: [],
    include: [],
    exclude: [],
  };

  if (args.length > 0 && COMMANDS.includes(args[0])) {
    options.command = args.shift();
  }

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--help" || arg === "-h") {
      options.command = "help";
    } else if (arg === "--version" || arg === "-v") {
      options.command = "version";
    } else if (arg === "--quiet" || arg === "-q") {
      options.quiet = true;
    } else if (arg === "--fix") {
      options.fix = true;
    } else if (VALUE_FLAGS.has(arg)) {
      const value = args[index + 1];
      if (value === undefined || value.startsWith("--")) {
        throw new UsageError(`${arg} needs a value`);
      }
      index += 1;
      applyValue(options, arg, value);
    } else if (arg.startsWith("-")) {
      throw new UsageError(`Unknown option: ${arg}`);
    } else {
      options.positionals.push(arg);
    }
  }

  if (options.command === "explain") {
    if (options.positionals.length !== 1) {
      throw new UsageError("explain needs exactly one rule name, for example: vhite explain console-log");
    }
    options.ruleName = options.positionals[0];
  } else if (options.command === "scan" || options.command === "fix") {
    if (options.positionals.length > 1) {
      throw new UsageError("Only one folder can be scanned at a time");
    }
    options.path = options.positionals[0] ?? ".";
  }

  return options;
}

function applyValue(options, flag, value) {
  if (flag === "--format") {
    if (!FORMATS.includes(value)) {
      throw new UsageError(`--format must be text or json, not "${value}"`);
    }
    options.format = value;
  } else if (flag === "--rule") {
    options.rules.push(value);
  } else if (flag === "--disable") {
    options.disable.push(value);
  } else if (flag === "--include") {
    options.include.push(value);
  } else if (flag === "--exclude") {
    options.exclude.push(value);
  }
}

export function normalizePath(path) {
  const cleaned = path.replace(/\\/g, "/").replace(/^\.\//, "").replace(/\/+$/, "");
  return cleaned === "." ? "" : cleaned;
}

export function isIncluded(relativePath, include, exclude) {
  const rel = normalizePath(relativePath);
  const matches = (prefix) => {
    const clean = normalizePath(prefix);
    return clean === "" || rel === clean || rel.startsWith(`${clean}/`);
  };

  if (include.length > 0 && !include.some(matches)) return false;
  if (exclude.some(matches)) return false;
  return true;
}