  import { frontendExplanations } from "./explanations-frontend.js";
export const explanations = {
   "leftover-todo": {
    whatHappened: "A comment is still in the code. Comments that mark unfinished work (TODO or FIXME) are easy to forget before release, and other comments can go out of date and mislead the next developer.",
    proposedChange: "Finish the task and delete the note, or move it to your issue tracker. Delete other comments that no longer explain anything.",
  },
  "debugger-statement": {
    whatHappened: "A debugger statement pauses the program whenever developer tools are open. Left in, it can freeze the app for anyone who has them open.",
    proposedChange: "Delete the debugger line.",
  },
  "console-log": {
    whatHappened: "A console.log call prints a message to the console. It's often a leftover from debugging, and it can reveal internal details to anyone who opens developer tools.",
    proposedChange: "Delete the line if it was only for debugging. If the output is needed, keep it but make the message clear, or remove it before release.",
  },
  "empty-catch": {
    whatHappened: "This catch block catches an error and does nothing with it. If something fails, the app keeps going silently and nobody sees the problem.",
    proposedChange: "Log the error, for example with console.error(error), or show the user a helpful message. If ignoring the error is truly intended, add a comment explaining why.",
  },
  "unused-import": {
    whatHappened: "This file imports something it never uses. It adds clutter and can make the file load slower.",
    proposedChange: "Delete the unused import line.",
  },
  "empty-block": {
    whatHappened: "An if, else, or loop has a body with no code in it. This often means logic was started and never finished.",
    proposedChange: "Add the missing logic, or delete the block if it isn't needed. If the empty block is intentional, add a comment saying so.",
  },
  "hardcoded-secret": {
    whatHappened: "A value that looks like a password, API key, or token is written directly in the code. Anyone who can read the code can use it.",
    proposedChange: "Move the value into an environment variable or a settings file that isn't shared. If it was a real value, replace it at the service that issued it, since it may already be exposed.",
  },
  parser: {
    whatHappened: "vhite couldn't read this file as JavaScript, so it skipped the checks that need to understand the code.",
    proposedChange: "Open the file at the line shown and fix the syntax error, then scan again.",
  },
      ...frontendExplanations,
};

