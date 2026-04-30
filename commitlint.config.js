// Commitlint configuration — extends conventional commits standard.
// See .claude/rules/commit.md for project commit conventions.
/** @type {import('@commitlint/types').UserConfig} */
export default {
  extends: ["@commitlint/config-conventional"],
  rules: {
    // Allowed types per .claude/rules/commit.md
    "type-enum": [
      2,
      "always",
      ["feat", "fix", "refactor", "docs", "test", "chore", "style", "perf", "ci", "revert"],
    ],
    // Description must be lowercase, no period at end, under 72 chars
    "subject-case": [2, "always", "lower-case"],
    "subject-full-stop": [2, "never", "."],
    "header-max-length": [2, "always", 72],
    // Body lines max 100 chars
    "body-max-line-length": [2, "always", 100],
  },
};
