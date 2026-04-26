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
#  What it does:
#    1. Ensures 5 git worktrees exist for the 5 NEW work streams.
#    2. Opens 10 Windows Terminal tabs (or 10 PowerShell windows fallback),
#       each cd-ed into the right working directory with a short brief printed.
#    3. Does NOT auto-launch claude -- you start it yourself per tab.
#
#  Pure ASCII -- safe for Windows PowerShell 5.1 default encoding.
# =============================================================================

$ErrorActionPreference = "Continue"
$RepoRoot = "C:\Users\user\aevion-core"
$BankWT   = "$RepoRoot\frontend-bank"

Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  AEVION : launching 10 parallel work sessions" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host ""

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
# Step 2. Define the 10 sessions (briefs use ASCII only)
# -----------------------------------------------------------------------------
$Sessions = @(
  # ----- Group A: continuing tracks (frontend-bank/ on bank-payment-layer)
  @{
    Title = "A1-Bank-polish"
    Path  = $BankWT
    Brief = @(
      "Track: Bank UI polish (already shipped 18 features + 5 Autopilot rules + multilingual).",
      "Branch: bank-payment-layer (PR 5 open). Worktree: frontend-bank/",
      "Goals today: bug-fix sweep, UX micro-polish, mobile responsiveness audit,",
      "  performance (Lighthouse), accessibility (axe), final QA before merge to main.",
      "Start: cd frontend ; claude"
    )
  },
  @{
    Title = "A2-Pitch-evolution"
    Path  = $BankWT
    Brief = @(
      "Track: /pitch tour expansion (live metrics, competitive, risks, OG, FAQ shipped).",
      "Branch: bank-payment-layer. Files: src/app/pitch/, src/data/pitchModel.ts",
      "Goals: case-study quotes, real partner logos when allowed, video walkthrough",
      "  links, clearer Year 1 traction chart, optional /pitch/print route.",
      "Start: cd frontend ; claude"
    )
  },
  @{
    Title = "A3-Demo-refresh"
    Path  = $BankWT
    Brief = @(
      "Track: rewrite /demo and /demo/deep with the new pitchModel narrative.",
      "Branch: bank-payment-layer. Files: src/app/demo/, src/data/demoNarrative.ts, demoDeep.ts",
      "Goals: align /demo with /pitch numbers, add live metrics row to /demo,",
      "  fill /demo/deep with architecture diagrams, threat model, perf budgets.",
      "Start: cd frontend ; claude"
    )
  },
  @{
    Title = "A4-Multichat-to-live"
    Path  = $BankWT
    Brief = @(
      "Track: take Multichat Engine from beta to live.",
      "Branch: bank-payment-layer. Files: src/app/multichat-engine/, /api/qcoreai/chat",
      "Goals: parallel session UI, role isolation per agent, persistence,",
      "  white-label B2B preview, ship as a real consumable product surface.",
      "Start: cd frontend ; claude"
    )
  },
  @{
    Title = "A5-Awards-UX"
    Path  = $BankWT
    Brief = @(
      "Track: real submission flow for Awards/Music + Awards/Film.",
      "Branch: bank-payment-layer. Files: src/app/awards/{music,film}/, AwardPortal component",
      "Goals: submission form, vote UI, leaderboard with live Planet stats,",
      "  AEC payout preview tied to Bank, jury panel mechanics.",
      "Start: cd frontend ; claude"
    )
  },

  # ----- Group B: new tracks (each in its own worktree from main)
  @{
    Title = "B1-Globus-polish"
    Path  = "$RepoRoot\frontend-globus"
    Brief = @(
      "NEW track: rewrite the home page (the Globus / 27-node map) to wow investors.",
      "Branch: globus-polish (forked from main). Worktree: frontend-globus/",
      "Goals: interactive 3D / SVG map, click any node -> live status drawer,",
      "  hero refresh aligned with /pitch numbers, pull /api/globus/projects live.",
      "First file to read: frontend/src/app/page.tsx (998 lines -- careful).",
      "Start: cd frontend ; npm install --include=optional ; claude"
    )
  },
  @{
    Title = "B2-AEC-Exchange"
    Path  = "$RepoRoot\frontend-exchange"
    Brief = @(
      "NEW track: AEC internal exchange / liquidity engine.",
      "Branch: aec-exchange. Worktree: frontend-exchange/",
      "Goals: design /exchange route -- order book for AEC vs module-credit pairs",
      "  (royalty credit, chess credit, planet credit), AMM-style pricing,",
      "  treasury controls. Ship as preview behind feature flag.",
      "Backend contracts to propose: /api/exchange/book, /quote, /trade.",
      "Start: cd frontend ; npm install --include=optional ; claude"
    )
  },
  @{
    Title = "B3-Payments-rail"
    Path  = "$RepoRoot\frontend-payments"
    Brief = @(
      "NEW track: cross-module payments hardening (Bank, QTrade, Awards, Planet).",
      "Branch: payments-rail. Worktree: frontend-payments/",
      "Goals: unified send-money primitive used by every module, settlement",
      "  audit log, recurring + scheduled + split + gift modes consolidated,",
      "  reconciliation report, real-time balance everywhere.",
      "Files: src/app/bank/_components/SendForm.tsx, _lib/api.ts",
      "Start: cd frontend ; npm install --include=optional ; claude"
    )
  },
  @{
    Title = "B4-GTM-pricing-apidocs"
    Path  = "$RepoRoot\frontend-gtm"
    Brief = @(
      "NEW track: investor-grade /pricing + /api-docs.",
      "Branch: gtm-pricing-api. Worktree: frontend-gtm/",
      "Goals: tiered pricing page (Free / Pro / Enterprise) per module bundle,",
      "  hosted /api-docs reading from /api/openapi.json with try-it console,",
      "  partner program landing, embeds for iframe marketing.",
      "Start: cd frontend ; npm install --include=optional ; claude"
    )
  },
  @{
    Title = "B5-Chess-tournaments"
    Path  = "$RepoRoot\frontend-chess"
    Brief = @(
      "NEW track: real CyberChess tournaments with AEC prize pools.",
      "Branch: chess-tournaments. Worktree: frontend-chess/",
      "Goals: tournament creation, brackets, live spectating, AEC entry fees,",
      "  Trust-Score-gated brackets (elite-only), anti-cheat hooks via Trust Graph,",
      "  prize-pool auto-payout to Bank.",
      "Files: src/app/cyberchess/page.tsx (1137 lines -- read engine first)",
      "Start: cd frontend ; npm install --include=optional ; claude"
    )
  }
)

# -----------------------------------------------------------------------------
# Step 3. Open the 10 tabs/windows
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

function Build-TabCommand($session) {
  $cmd = "Set-Location '" + $session.Path + "'; "
  $cmd += "Write-Host '=== " + $session.Title + " ===' -ForegroundColor Cyan; "
  foreach ($line in $session.Brief) {
    $safe = $line -replace "'", "''"
    $cmd += "Write-Host '  " + $safe + "' -ForegroundColor Gray; "
  }
  $cmd += "Write-Host ''; Write-Host 'Ready. Type: claude' -ForegroundColor Green"
  return $cmd
}

if ($useWT) {
  $wtArgs = New-Object System.Collections.Generic.List[string]
  $first = $true
  foreach ($s in $Sessions) {
    $cmd = Build-TabCommand $s
    if (-not $first) { $wtArgs.Add(";") }
    $wtArgs.Add("new-tab")
    $wtArgs.Add("--title")
    $wtArgs.Add($s.Title)
    $wtArgs.Add("-d")
    $wtArgs.Add($s.Path)
    $wtArgs.Add("powershell.exe")
    $wtArgs.Add("-NoExit")
    $wtArgs.Add("-Command")
    $wtArgs.Add($cmd)
    $first = $false
  }
  Start-Process wt.exe -ArgumentList $wtArgs.ToArray()
} else {
  foreach ($s in $Sessions) {
    $cmd  = "`$Host.UI.RawUI.WindowTitle = '" + $s.Title + "'; "
    $cmd += Build-TabCommand $s
    Start-Process powershell -ArgumentList @("-NoExit", "-Command", $cmd) | Out-Null
  }
}

Write-Host ""
Write-Host "[3/3] Done." -ForegroundColor Green
Write-Host ""
Write-Host "Tip: each tab/window has its own brief and cwd ready. Type 'claude' to start." -ForegroundColor Cyan
Write-Host "     Read SESSIONS_README.md for the full plan and per-track first prompts." -ForegroundColor Cyan
Write-Host ""
