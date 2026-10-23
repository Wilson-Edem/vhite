import leftoverTodo from "./core/leftover-todo.js";
import debuggerStatement from "./core/debugger-statement.js";
import consoleLog from "./core/console-log.js";
import emptyCatch from "./core/empty-catch.js";
import unusedImport from "./core/unused-import.js";
import emptyBlock from "./core/empty-block.js";
import hardcodedSecret from "./core/hardcoded-secret.js";
import reactMissingKey from "./react/react-missing-key.js";
import reactDangerousHtml from "./react/react-dangerous-html.js";
import a11yImgAlt from "./a11y/a11y-img-alt.js";
import a11yInputLabel from "./a11y/a11y-input-label.js";
import a11yClickDiv from "./a11y/a11y-click-div.js";

export const rules = [
  leftoverTodo,
  debuggerStatement,
  consoleLog,
  emptyCatch,
  unusedImport,
  emptyBlock,
  hardcodedSecret,
  reactMissingKey,
  reactDangerousHtml,
  a11yImgAlt,
  a11yInputLabel,
  a11yClickDiv,
];