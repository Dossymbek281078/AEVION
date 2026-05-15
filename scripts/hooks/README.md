# AEVION git hooks

## pre-commit-strip-bom.sh

### Why
Notepad and some IDE encoding defaults (Windows) save files with a UTF-8 BOM
(`EF BB BF` at byte 0). **Node.js v24 rejects BOM in CJS modules** — this
causes a hard crash or `SyntaxError: Invalid or unexpected token` at require
time. We accumulated ~109 BOM-tainted source files this way; this hook
prevents new ones from sneaking in.

### What it does
- Runs on every `git commit`.
- Scans staged files matching `*.ts *.tsx *.js *.json *.mjs *.cjs`.
- For each file whose first 3 bytes are `EF BB BF`:
  - Strips the BOM in-place.
  - Re-stages the cleaned file via `git add`.
- Prints which files were cleaned.
- **Always exits 0** — the commit proceeds with the cleaned content. It does
  not reject; it auto-fixes silently.

### Install (one-time, per clone)
The `.git/hooks/` directory is local to each clone and **never committed**.
After cloning, run:

**Windows / PowerShell:**
```powershell
powershell -ExecutionPolicy Bypass -File scripts\install-hooks.ps1
```

**Linux / macOS / Git-Bash:**
```bash
bash scripts/install-hooks.sh
```

Worktrees inherit `.git/hooks` from the main repo automatically — no need to
re-install per worktree.

### Verify
After install, intentionally stage a BOM'd file and commit. You should see:
```
  stripped BOM: path/to/file.ts
  -> 1 files cleaned (BOM stripped, re-staged)
```

### Disable (if ever needed)
- One commit only: `git commit --no-verify`
- Permanently for this clone: `rm .git/hooks/pre-commit`
- Re-enable: re-run the installer.

### Adding more extensions
Edit `pre-commit-strip-bom.sh`, extend the `git diff --cached --name-only`
glob list. Common candidates: `*.css *.scss *.md *.yml *.yaml`.
