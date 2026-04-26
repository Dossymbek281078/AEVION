# =============================================================================
#  AEVION -- Open 10 parallel Claude Code sessions
#  Last updated: 2026-04-26
#
#  Usage:
#    From PowerShell:
#      & "C:\Users\user\aevion-core\frontend-bank\START_SESSIONS.ps1"
#
#    If execution-policy error:
#      Set-ExecutionPolicy -Scope Process Bypass -Force; & "C:\Users\user\aevion-core\frontend-bank\START_SESSIONS.ps1"
#
#    From cmd.exe / Win+R:
#      powershell -ExecutionPolicy Bypass -File "C:\Users\user\aevion-core\frontend-bank\START_SESSIONS.ps1"
#
#  How it works:
#    1. Refreshes main + ensures 5 worktrees exist for the new tracks.
#    2. Reads session metadata (titles + RU briefs) from SESSIONS_DATA.json
#       which sits next to this script.
#    3. Writes one per-session .ps1 into %TEMP%\AEVION_SESSIONS\ with
#       UTF-8 BOM so Windows PowerShell 5.1 reads Cyrillic correctly.
#    4. Opens 10 Windows Terminal tabs (or 10 PowerShell windows fallback).
#    5. Does NOT auto-launch claude -- you start it yourself per tab.
#
#  This file itself is pure ASCII so it always parses on PS 5.1.
# =============================================================================

$ErrorActionPreference = "Continue"
$RepoRoot   = "C:\Users\user\aevion-core"
$BankWT     = "$RepoRoot\frontend-bank"
$DataFile   = Join-Path $BankWT "SESSIONS_DATA.json"
$TempDir    = Join-Path $env:TEMP "AEVION_SESSIONS"

Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  AEVION : launching 10 parallel work sessions" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host ""

if (-not (Test-Path $DataFile)) {
  Write-Host "ERROR: SESSIONS_DATA.json not found at $DataFile" -ForegroundColor Red
  Write-Host "Make sure the JSON sits next to START_SESSIONS.ps1." -ForegroundColor Red
  exit 1
}

# -----------------------------------------------------------------------------
# Step 1. Refresh main and ensure worktrees
# -----------------------------------------------------------------------------
Write-Host "[1/3] Refreshing main branch + ensuring worktrees..." -ForegroundColor Yellow

Push-Location $RepoRoot
git fetch origin 2>&1 | Out-Null
Pop-Location

$Worktrees = @(
  @{ Path = "$RepoRoot\frontend-globus";   Branch = "globus-polish";     Base = "main" },
  @{ Path = "$RepoRoot\frontend-exchange"; Branch = "aec-exchange";      Base = "main" },
  @{ Path = "$RepoRoot\frontend-payments"; Branch = "payments-rail";     Base = "main" },
  @{ Path = "$RepoRoot\frontend-gtm";      Branch = "gtm-pricing-api";   Base = "main" },
  @{ Path = "$RepoRoot\frontend-chess";    Branch = "chess-tournaments"; Base = "main" }
)

foreach ($wt in $Worktrees) {
  if (Test-Path $wt.Path) {
    Write-Host ("    [OK] worktree exists: " + $wt.Path) -ForegroundColor Green
  } else {
    Write-Host ("    [+]  creating worktree: " + $wt.Path + " (branch: " + $wt.Branch + ")") -ForegroundColor Cyan
    Push-Location $RepoRoot
    git worktree add $wt.Path -b $wt.Branch $wt.Base 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) {
      git worktree add $wt.Path $wt.Branch 2>&1 | Out-Null
    }
    Pop-Location
  }
}

Write-Host ""

# -----------------------------------------------------------------------------
# Step 2. Load session data (UTF-8 JSON with Russian briefs)
# -----------------------------------------------------------------------------
$jsonRaw = Get-Content -Raw -Encoding UTF8 -LiteralPath $DataFile
$data    = $jsonRaw | ConvertFrom-Json
$Sessions = $data.sessions
$UiReady  = $data.ui.ready

# -----------------------------------------------------------------------------
# Step 3. Generate per-session .ps1 files in %TEMP%\AEVION_SESSIONS\
#         (with UTF-8 BOM so PS 5.1 renders Cyrillic correctly)
# -----------------------------------------------------------------------------
if (-not (Test-Path $TempDir)) {
  New-Item -ItemType Directory -Path $TempDir | Out-Null
}

$utf8Bom = New-Object System.Text.UTF8Encoding $true

foreach ($s in $Sessions) {
  $perSessionFile = Join-Path $TempDir ($s.id + ".ps1")
  $sb = New-Object System.Text.StringBuilder
  [void]$sb.AppendLine('chcp 65001 > $null')
  [void]$sb.AppendLine('[Console]::OutputEncoding = [System.Text.Encoding]::UTF8')
  [void]$sb.AppendLine('$Host.UI.RawUI.WindowTitle = "' + $s.title.Replace('"', '`"') + '"')
  [void]$sb.AppendLine('Set-Location -LiteralPath "' + $s.path + '"')
  [void]$sb.AppendLine('Write-Host ""')
  [void]$sb.AppendLine('Write-Host "=== ' + $s.title.Replace('"', '`"') + ' ===" -ForegroundColor Cyan')
  foreach ($line in $s.brief) {
    $safe = $line.Replace('"', '`"')
    [void]$sb.AppendLine('Write-Host "  ' + $safe + '" -ForegroundColor Gray')
  }
  [void]$sb.AppendLine('Write-Host ""')
  $readySafe = $UiReady.Replace('"', '`"')
  [void]$sb.AppendLine('Write-Host "' + $readySafe + '" -ForegroundColor Green')
  [void]$sb.AppendLine('Write-Host ""')
  [System.IO.File]::WriteAllText($perSessionFile, $sb.ToString(), $utf8Bom)
}

# -----------------------------------------------------------------------------
# Step 4. Open the 10 tabs/windows
# -----------------------------------------------------------------------------
$wtCmd = Get-Command wt.exe -ErrorAction SilentlyContinue
$useWT = $null -ne $wtCmd

Write-Host "[2/3] Opening 10 sessions..." -ForegroundColor Yellow
if ($useWT) {
  Write-Host "      Using Windows Terminal (wt.exe) -- single window, 10 tabs." -ForegroundColor Gray
} else {
  Write-Host "      Windows Terminal not found -- falling back to 10 PowerShell windows." -ForegroundColor Gray
  Write-Host "      (Install Windows Terminal from Microsoft Store for a nicer experience.)" -ForegroundColor Gray
}
Write-Host ""

if ($useWT) {
  $wtArgs = New-Object System.Collections.Generic.List[string]
  $first = $true
  foreach ($s in $Sessions) {
    $perSessionFile = Join-Path $TempDir ($s.id + ".ps1")
    if (-not $first) { $wtArgs.Add(";") }
    $wtArgs.Add("new-tab")
    $wtArgs.Add("--title")
    $wtArgs.Add($s.title)
    $wtArgs.Add("-d")
    $wtArgs.Add($s.path)
    $wtArgs.Add("powershell.exe")
    $wtArgs.Add("-NoExit")
    $wtArgs.Add("-ExecutionPolicy")
    $wtArgs.Add("Bypass")
    $wtArgs.Add("-File")
    $wtArgs.Add($perSessionFile)
    $first = $false
  }
  Start-Process wt.exe -ArgumentList $wtArgs.ToArray()
} else {
  foreach ($s in $Sessions) {
    $perSessionFile = Join-Path $TempDir ($s.id + ".ps1")
    Start-Process powershell -ArgumentList @("-NoExit", "-ExecutionPolicy", "Bypass", "-File", $perSessionFile) | Out-Null
  }
}

Write-Host ""
Write-Host "[3/3] Done." -ForegroundColor Green
Write-Host ""
Write-Host "Tip: each tab/window has its own brief and cwd ready. Type 'claude' to start." -ForegroundColor Cyan
Write-Host "     Tab titles are editable: right-click tab > Rename." -ForegroundColor Cyan
Write-Host "     Read SESSIONS_README.md for the full plan and per-track first prompts." -ForegroundColor Cyan
Write-Host ("     Per-session scripts live in: " + $TempDir) -ForegroundColor DarkGray
Write-Host ""
