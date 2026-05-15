#!/usr/bin/env bash
# Strip UTF-8 BOM from staged .ts/.tsx/.js/.json files before commit.
# Node v24 rejects BOM in CJS modules (segfault / parse error).
# Installed via scripts/install-hooks.{sh,ps1} — see scripts/hooks/README.md

staged=$(git diff --cached --name-only --diff-filter=ACM -- '*.ts' '*.tsx' '*.js' '*.json' '*.mjs' '*.cjs')
fixed=0
for f in $staged; do
  if [ -f "$f" ]; then
    # Detect BOM via first 3 bytes
    first3=$(head -c 3 "$f" | od -An -tx1 | tr -d ' ')
    if [ "$first3" = "efbbbf" ]; then
      # Strip BOM
      tail -c +4 "$f" > "$f.tmp" && mv "$f.tmp" "$f"
      git add "$f"
      echo "  stripped BOM: $f"
      fixed=$((fixed + 1))
    fi
  fi
done
if [ $fixed -gt 0 ]; then
  echo "  -> $fixed files cleaned (BOM stripped, re-staged)"
fi
exit 0
