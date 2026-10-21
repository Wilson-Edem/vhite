#!/usr/bin/env node
import { resolve, join } from "node:path";
import { existsSync } from "node:fs";
import { findFiles } from "../src/files.js";
import { runRules } from "../src/engine.js";
import { formatReport } from "../src/reporter.js";
import { loadConfig } from "../src/config.js";
import { CONFIG_NAME, canAskQuestions, runFirstTimeSetup } from "../src/setup.js";

console.log(`vhite is installed and running
    loading..
             ....
                 ......
                       ........
    Done..
    `);

const target = resolve(process.argv[2] ?? ".");

if (!existsSync(join(target, CONFIG_NAME)) && canAskQuestions()) {
  await runFirstTimeSetup(target);
}

let config;
try {
  config = await loadConfig(target);
} catch (error) {
  console.log(`Error: ${error.message}`);
  process.exit(1);
}

for (const warning of config.warnings) {
  console.log(`Warning: ${warning}`);
}
if (config.disabledRules.size > 0) {
  console.log(`Rules turned off by ${CONFIG_NAME}: ${[...config.disabledRules].join(", ")}`);
}

const files = await findFiles(target);
console.log(`vhite found ${files.length} front-end files in ${target}
    `);

const issues = await runRules(files, { disabledRules: config.disabledRules });
console.log(formatReport(issues, target));