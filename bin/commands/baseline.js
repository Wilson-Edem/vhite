import { resolve, relative } from "node:path";
import { loadConfig } from "../../src/core/config.js";
import { EXIT } from "../../src/core/exit-codes.js";
import { BASELINE_NAME, buildBaseline, saveBaseline } from "../../src/scan/baseline.js";
import { selectFiles, collectIssues, disabledSetFor } from "./shared.js";

export async function runBaseline(options) {
  const target = resolve(options.path ?? ".");

  try {
    const config = await loadConfig(target);
    const disabled = disabledSetFor(config, options);
    const files = await selectFiles(target, options);
    const { issues } = await collectIssues(files, target, disabled, config, null);

    const baseline = buildBaseline(issues, target);
    const path = await saveBaseline(target, baseline);
    const count = issues.length;

    console.log(`Saved ${count} current issue(s) to ${relative(process.cwd(), path) || BASELINE_NAME}`);
    console.log("Only new issues will be reported from now on.");
    return EXIT.CLEAN;
  } catch (error) {
    console.error(`Error: ${error.message}`);
    return EXIT.ERROR;
  }
}