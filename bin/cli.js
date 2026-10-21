#!/usr/bin/env node
console.log(`vhite is installed and running
    loading..
             ....
                 ......
                       ........
    Done..
    `);
import { resolve } from "node:path";
import { findFiles } from "../src/files.js";
import { runRules } from "../src/engine.js";

const target = resolve(process.argv[2] ?? ".");
const files = await findFiles(target);

console.log(`vhite found ${files.length} front-end files in ${target}
    `);
for (const file of files) {
  console.log(file);
}

const issues = await runRules(files);

console.log(`vhite scanned ${files.length} files and found ${issues.length} issues`);