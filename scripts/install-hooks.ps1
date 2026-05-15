# Install git hooks for AEVION (Windows / PowerShell).
# Run from repo root:  powershell -ExecutionPolicy Bypass -File scripts\install-hooks.ps1

$ErrorActionPreference = "Stop"

$repoRoot = git rev-parse --show-toplevel
if (-not $repoRoot) {
    Write-Error "Not inside a git repository."
    exit 1
}

$hookDir = Join-Path $repoRoot ".git/hooks"
if (-not (Test-Path $hookDir)) {
    New-Item -ItemType Directory -Path $hookDir -Force | Out-Null
}

$src  = Join-Path $repoRoot "scripts/hooks/pre-commit-strip-bom.sh"
$dest = Join-Path $hookDir "pre-commit"

Copy-Item $src $dest -Force
Write-Host "Pre-commit hook installed: $dest"
Write-Host "It will auto-strip UTF-8 BOM from staged .ts/.tsx/.js/.json/.mjs/.cjs files."
