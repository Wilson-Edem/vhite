export const COMMANDS = ["scan", "fix", "baseline", "hook", "rules", "explain", "version", "help"];

const FORMATS = ["text", "json", "sarif"];
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
    changed: false,
    staged: false,
    useBaseline: true,
    watch: false,
    noPrompt: false,
    force: false,
    smartNotes: false,
    noSmartFixes: false,
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
    } else if (arg === "--changed") {
      options.changed = true;
    } else if (arg === "--staged") {
      options.staged = true;
    } else if (arg === "--no-baseline") {
      options.useBaseline = false;
    } else if (arg === "--no-prompt") {
      options.noPrompt = true;
    } else if (arg === "--watch") {
      options.watch = true;
            } else if (arg === "--no-smart-fixes") {
        options.noSmartFixes = true;
            } else if (arg === "--smart-notes") {
        options.smartNotes = true;
    } else if (arg === "--force") {
      options.force = true;
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

  if (options.changed && options.staged) {
    throw new UsageError("Use either --changed or --staged, not both");
  }

  if (options.watch && (options.command !== "scan" || options.format !== "text")) {
    throw new UsageError("--watch works only with a scan that prints text");
  }

  if (options.command === "explain") {
    if (options.positionals.length !== 1) {
      throw new UsageError("explain needs exactly one rule name, for example: vhite explain console-log");
    }
    options.ruleName = options.positionals[0];
  } else if (options.command === "hook") {
    const action = options.positionals[0];
    if (!["install", "remove"].includes(action)) {
      throw new UsageError("hook needs an action: vhite hook install or vhite hook remove");
    }
    if (options.positionals.length > 2) {
      throw new UsageError("Only one folder can be used with hook");
    }
    options.hookAction = action;
    options.path = options.positionals[1] ?? ".";
  } else if (["scan", "fix", "baseline"].includes(options.command)) {
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
      throw new UsageError(`--format must be text, json, or sarif, not "${value}"`);
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