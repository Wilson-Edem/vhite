export const USAGE = `Usage:
  vhite [path]              Scan a folder (default command)
  vhite scan [path]         Scan and report
  vhite fix [path]          Scan, then choose which fixes to apply
  vhite baseline [path]     Save current problems so only new ones are reported
  vhite rules               List all rules
  vhite explain <rule>      Explain one rule
  vhite version             Show the version

Options:
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
  --help, -h                Show this help

Exit codes:
  0  no problems
  1  problems found (errors or warnings; info notes do not count)
  2  configuration or runtime error
  3  fixes applied and no problems remain
  4  fixes were rolled back

Ignoring code:
  Put  // vhite-disable-next-line rule-name  above a line, or
       // vhite-disable-line rule-name  at the end of a line,
  to skip that finding. Leave out the rule name to skip every rule.`;

export const BANNER = `vhite is installed and running
   loading..
             ....
                  ......
                         ........
   Done..`;