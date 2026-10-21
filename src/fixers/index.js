import debuggerFixer from "./debugger-statement.js";
import unusedImportFixer from "./unused-import.js";

export const fixers = {
  [debuggerFixer.rule]: debuggerFixer,
  [unusedImportFixer.rule]: unusedImportFixer,
};