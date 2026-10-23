export const EXIT = {
  CLEAN: 0,
  ISSUES: 1,
  ERROR: 2,
  FIXED: 3,
  ROLLED_BACK: 4,
};

export function decideExitCode({ failed = false, rolledBack = 0, issues = 0, applied = 0 }) {
  if (failed) return EXIT.ERROR;
  if (rolledBack > 0) return EXIT.ROLLED_BACK;
  if (issues > 0) return EXIT.ISSUES;
  if (applied > 0) return EXIT.FIXED;
  return EXIT.CLEAN;
}