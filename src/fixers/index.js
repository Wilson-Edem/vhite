import debuggerFixer from "./debugger-statement.js";
import unusedImportFixer from "./unused-import.js";
import commentFixer from "./leftover-todo.js";

export const fixers = {
  [debuggerFixer.rule]: debuggerFixer,
  [unusedImportFixer.rule]: unusedImportFixer,
  [commentFixer.rule]: commentFixer,
};