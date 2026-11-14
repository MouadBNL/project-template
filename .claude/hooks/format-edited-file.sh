#!/bin/sh
# PostToolUse hook (.claude/settings.json): formats the file an agent just edited or wrote, with
# the repo's formatter (oxfmt through `vp fmt`, root vite.config.ts). Never blocks: a file the
# formatter does not handle, or a syntax error mid-edit, is left as is and `pnpm check` reports it.
file=$(node -e 'let s = ""; process.stdin.on("data", (d) => (s += d)).on("end", () => {
  const input = JSON.parse(s).tool_input ?? {};
  process.stdout.write(input.file_path ?? "");
});')
[ -n "$file" ] && [ -f "$file" ] || exit 0
cd "$(dirname "$file")" && "$CLAUDE_PROJECT_DIR/node_modules/.bin/vp" fmt --no-error-on-unmatched-pattern "$file" >/dev/null 2>&1
exit 0
