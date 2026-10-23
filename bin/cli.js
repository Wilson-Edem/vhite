#!/usr/bin/env node

import { parseArgs, UsageError } from "../src/core/args.js";
import { EXIT } from "../src/core/exit-codes.js";
import { readVersion } from "../src/core/version.js";
import { USAGE } from "./output/text.js";
import { listRules, explainRule } from "./commands/info.js";
import { runBaseline } from "./commands/baseline.js";
import { runScan } from "./commands/scan.js";
import { runHook } from "./commands/hook.js";
import { runWatch } from "./commands/watch.js";

async function main() {
  let options;
  try {
    options = parseArgs(process.argv.slice(2));
  } catch (error) {
    if (error instanceof UsageError) {
      console.error(`Error: ${error.message}\n`);
      console.error(USAGE);
      return EXIT.ERROR;
    }
    throw error;
  }

  if (options.command === "help") {
    console.log(USAGE);
    return EXIT.CLEAN;
  }

  if (options.command === "version") {
    console.log(await readVersion());
    return EXIT.CLEAN;
  }

  if (options.command === "rules") {
    return listRules();
  }

  if (options.command === "explain") {
    return explainRule(options.ruleName);
  }

  if (options.command === "baseline") {
    return runBaseline(options);
  }

  if (options.command === "hook") {
    return runHook(options);
  }

  if (options.watch) {
    return runWatch(options);
  }

  return runScan(options);
}

process.exitCode = await main();