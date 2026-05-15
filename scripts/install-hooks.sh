#!/usr/bin/env bash
# Install git hooks for AEVION (Linux / macOS / Git-Bash).
# Run from repo root:  bash scripts/install-hooks.sh
set -e

repo_root=$(git rev-parse --show-toplevel)
if [ -z "$repo_root" ]; then
  echo "Not inside a git repository." >&2
  exit 1
fi

mkdir -p "$repo_root/.git/hooks"
cp "$repo_root/scripts/hooks/pre-commit-strip-bom.sh" "$repo_root/.git/hooks/pre-commit"
chmod +x "$repo_root/.git/hooks/pre-commit"

echo "Pre-commit hook installed: $repo_root/.git/hooks/pre-commit"
echo "It will auto-strip UTF-8 BOM from staged .ts/.tsx/.js/.json/.mjs/.cjs files."
