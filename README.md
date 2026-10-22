# @vhite/vhite

vhite scans front-end code for common problems left behind by AI code generators, explains each one in plain English, and can safely fix some of them.

## Install and run

Run it on any project folder without installing it:

    npx @vhite/vhite path/to/your/project

Or run it on the current folder:

    npx @vhite/vhite .

## What it checks

- **Debugger statements:** `debugger` lines that pause the app when developer tools are open.
- **console.log calls:** logging left over from debugging.
- **Empty catch blocks:** errors that are caught and silently ignored.
- **Unused imports:** imports the file never uses.
- **Empty blocks:** `if`, `else`, and loop bodies with no code.
- **Hardcoded secrets:** passwords, API keys, and tokens written directly in the code.
- **Comments:** every comment is flagged. TODO and FIXME notes get their own message.

Supported file types: `.js`, `.jsx`, `.mjs`, `.cjs`, `.html`, and `.css`. Some checks only apply to JavaScript files.

## Safe fixes

Some problems can be fixed automatically: debugger statements, unused imports, and comments. vhite never changes a file without asking first.

1. It scans the project and lists the problems it found.
2. It lists the fixes it can make and asks which ones to apply. Enter numbers such as `1,3`, type `all`, or press Enter to skip.
3. Before each change, it saves a backup in `.vhite-fix/backup/`.
4. After each change, it scans the file again. If the change created a new problem or didn't fix the issue, the original is restored automatically.
5. At the end, it can ask whether to delete the backups from this run and whether to create a Markdown report in `.vhite-fix/reports/`.

The first time a fix is applied, vhite adds `.vhite-fix/` to your `.gitignore`, so backups and reports stay out of your repository.

Fixes only run in an interactive terminal. In scripts or CI, vhite only reports problems.

## Settings

Create a `vhite.config.json` file in your project to turn off specific checks:

    {
      "disabledRules": ["console-log", "leftover-todo"]
    }

Use the rule names shown in the report, in brackets at the end of each line.

## Limits

vhite finds common patterns. It does not understand your whole app, so review each fix before you commit it. Removing an unused import also stops that module from loading, which is usually what you want, but check modules that only run for their side effects.

## License

ISC