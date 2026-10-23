# @vhite/vhite

vhite scans front-end code for problems commonly left behind by AI code generators. It explains each finding in plain English, and it can safely fix some of them.

## Install and run

Run it on any project without installing it:

    npx @vhite/vhite path/to/your/project

Or on the current folder:

    npx @vhite/vhite

To install it once and use a short command:

    npm install -g @vhite/vhite
    vhite path/to/your/project

## Commands

    vhite [path]              Scan a folder (the default command)
    vhite scan [path]         Scan and report
    vhite fix [path]          Scan, then choose which fixes to apply
    vhite baseline [path]     Save current problems so only new ones are reported
    vhite rules               List all rules
    vhite explain <rule>      Explain one rule
    vhite version             Show the version

## Options

    --format text|json        Output format (default: text)
    --quiet, -q               Print only errors; the exit code still applies
    --fix                     Apply all safe fixes without asking, then rescan
    --changed                 Scan only files changed since the last commit (Git)
    --staged                  Scan only files staged for commit (Git)
    --no-baseline             Ignore vhite.baseline.json for this run
    --rule <name>             Run only this rule (repeatable)
    --disable <name>          Turn off a rule (repeatable)
    --include <path>          Scan only files under this path (repeatable)
    --exclude <path>          Skip files under this path (repeatable)
    --help, -h                Show help

## Exit codes

    0  no problems
    1  problems found (errors or warnings; info notes do not count)
    2  configuration or runtime error
    3  fixes applied and no problems remain
    4  fixes were rolled back

Use these in CI. For example, a build fails when the exit code is 1 or higher.

## What it checks

JavaScript and JSX files (`.js`, `.jsx`, `.mjs`, `.cjs`):

- **debugger-statement:** `debugger` lines that pause the app when developer tools are open.
- **console-log:** `console.log` calls left over from debugging.
- **empty-catch:** errors that are caught and silently ignored.
- **unused-import:** imports the file never uses.
- **empty-block:** `if`, `else`, and loop bodies with no code.
- **hardcoded-secret:** passwords, API keys, and tokens written directly in the code.
- **leftover-todo:** comments. TODO and FIXME notes are reported separately from other comments.
- **react-missing-key:** list items created with `.map()` that have no `key`.
- **react-dangerous-html:** uses of `dangerouslySetInnerHTML`.
- **a11y-img-alt:** images with no `alt` attribute.
- **a11y-input-label:** form inputs with no label or accessible name.
- **a11y-click-div:** clickable `div` or `span` elements with no `role`.

HTML and CSS files (`.html`, `.css`) are checked for hardcoded secrets only.

Run `vhite rules` for the full list, with each rule's default severity and whether it has an automatic fix.

## Severity

Each rule has a severity: `error`, `warning`, or `info`. Errors and warnings count toward the exit code. Info notes are shown but don't fail a run.

Change a rule's severity in `vhite.config.json`:

    {
      "rules": {
        "console-log": "error",
        "leftover-todo": "off"
      }
    }

Use `"off"` to turn a rule off. You can also turn rules off with a list:

    {
      "disabledRules": ["console-log"]
    }

Unknown rule names are reported as warnings, and the rest of the config still applies.

## Safe fixes

Some problems can be fixed automatically: debugger statements, unused imports, and comments. vhite never changes a file without your approval.

1. It scans the project and lists the problems it found.
2. It lists the fixes it can make and asks which ones to apply. Enter numbers such as `1,3`, type `all`, or press Enter to skip.
3. Before each change, it saves a backup in `.vhite-fix/backup/`.
4. After each change, it scans the file again. If the change created a new problem or didn't fix the issue, the original is restored automatically.
5. At the end, it can ask whether to delete the backups from this run and whether to create a Markdown report in `.vhite-fix/reports/`.

The first time a fix is applied, vhite adds `.vhite-fix/` to your `.gitignore`.

For scripts and CI, use `--fix` to apply all safe fixes without asking. `vhite fix` requires an interactive terminal unless `--fix` is given.

## Baselines

Projects that already have problems can start with a baseline:

    vhite baseline

This saves the current findings to `vhite.baseline.json`. Later scans hide those known findings and report only new ones. A finding stays hidden even if its line number moves. Commit this file so your whole team shares the same baseline, and use `--no-baseline` to see everything.

## Ignoring a finding

Add a comment to skip a finding you've reviewed:

    // vhite-disable-next-line console-log
    console.log("kept on purpose");

    console.log("kept on purpose"); // vhite-disable-line console-log

Leave out the rule name to skip every rule on that line.

## Scanning only changed files

    vhite --changed    # files changed since the last commit
    vhite --staged     # files staged for commit

Both need the project to be a Git repository.

## Settings file

Ignore patterns come from your `.gitignore`. vhite also skips `node_modules`, `dist`, `build`, and `.git` by default.

## Reports

    --format json      Prints results as JSON for scripts and other tools

The JSON output includes each finding's rule, severity, file, line, column, and message, plus a summary and any fixes that were applied.

## Limits

vhite finds common patterns. It can't understand your whole app, so review each fix before you commit it. Removing an unused import also stops that module from loading, which is usually what you want, but check modules that only run for their side effects. The accessibility and React rules are heuristics and may report some false positives.

## License

ISC