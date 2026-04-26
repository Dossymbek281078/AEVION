# ============================================================================
#  AEVION — Open 10 parallel Claude Code sessions
#  Last updated: 2026-04-26
#
#  Usage:
#     # From PowerShell (most common):
#     & "C:\Users\user\aevion-core\frontend-bank\START_SESSIONS.ps1"
#
#     # If you get execution-policy error:
#     Set-ExecutionPolicy -Scope Process Bypass -Force; & "C:\Users\user\aevion-core\frontend-bank\START_SESSIONS.ps1"
#
#     # From cmd.exe / Win+R Run dialog:
#     powershell -ExecutionPolicy Bypass -File "C:\Users\user\aevion-core\frontend-bank\START_SESSIONS.ps1"
#
#  Or: copy this file anywhere, double-click → choose "Run with PowerShell"
#
#  What it does:
#    1. Ensures 5 git worktrees exist for the 5 NEW work streams (creates branches if needed).
#    2. Opens 10 Windows Terminal tabs (or 10 PowerShell windows if wt.exe missing),
#       each cd'd into the right working directory with a short brief printed.
#    3. Does NOT auto-launch `claude` — you start it yourself per tab so each session
#       loads its own CLAUDE.md context cleanly.
#
#  Layout:
#     Group A — "Continue tracks" (5 tabs, all in frontend-bank/ on bank-payment-layer)
#     Group B — "New tracks"      (5 tabs, each in its own worktree from main)
# ============================================================================

$ErrorActionPreference = "Continue"
$RepoRoot = "C:\Users\user\aevion-core"
$BankWT   = "$RepoRoot\frontend-bank"

Write-Host ""
Write-Host "==================================================================" -ForegroundColor Cyan
Write-Host "  AEVION · launching 10 parallel work sessions" -ForegroundColor Cyan
Write-Host "==================================================================" -ForegroundColor Cyan
Write-Host ""

# ----------------------------------------------------------------------------
# Step 1. Make sure main branch is up to date and worktrees exist
# ----------------------------------------------------------------------------
Write-Host "[1/3] Refreshing main branch + ensuring worktrees..." -ForegroundColor Yellow

Push-Location $RepoRoot
git fetch origin 2>&1 | Out-Null
Pop-Location

# Group B worktrees: name → branch
$Worktrees = @(
  @{ Path = "$RepoRoot\frontend-globus";   Branch = "globus-polish";       Base = "main" },
  @{ Path = "$RepoRoot\frontend-exchange"; Branch = "aec-exchange";        Base = "main" },
  @{ Path = "$RepoRoot\frontend-payments"; Branch = "payments-rail";       Base = "main" },
  @{ Path = "$RepoRoot\frontend-gtm";      Branch = "gtm-pricing-api";     Base = "main" },
  @{ Path = "$RepoRoot\frontend-chess";    Branch = "chess-tournaments";   Base = "main" }
)

foreach ($wt in $Worktrees) {
  if (Test-Path $wt.Path) {
    Write-Host "    ✓ worktree exists: $($wt.Path)" -ForegroundColor Green
  } else {
    Write-Host "    + creating worktree: $($wt.Path) (branch: $($wt.Branch))" -ForegroundColor Cyan
    Push-Location $RepoRoot
    # try create new branch from main; fallback to checking out existing branch
    git worktree add $wt.Path -b $wt.Branch $wt.Base 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) {
      git worktree add $wt.Path $wt.Branch 2>&1 | Out-Null
    }
    Pop-Location
  }
}

Write-Host ""

# ----------------------------------------------------------------------------
# Step 2. Define the 10 sessions
# ----------------------------------------------------------------------------
$Sessions = @(
  # ───────── Group A — continuing tracks (frontend-bank/, bank-payment-layer)
  @{
    Title = "A1·Bank polish"
    Path  = $BankWT
    Color = "Cyan"
    Brief = @(
      "Track: Bank UI polish (already shipped 18 features + 5 Autopilot rules + multilingual)."
      "Branch: bank-payment-layer (PR #5 open). Worktree: frontend-bank/"
      "Goals today: bug-fix sweep, UX micro-polish, mobile responsiveness audit,"
      "  performance (Lighthouse), accessibility (axe), final QA before merge to main."
      "Start: cd frontend ; claude"
    )
  }
  @{
    Title = "A2·Pitch evolution"
    Path  = $BankWT
    Color = "Yellow"
    Brief = @(
      "Track: /pitch tour expansion (live metrics, competitive, risks, OG, FAQ shipped)."
      "Branch: bank-payment-layer. Files: src/app/pitch/, src/data/pitchModel.ts"
      "Goals: case-study quotes, real partner logos when allowed, video walkthrough"
      "  links, clearer 'Year 1 traction' chart, optional /pitch/print route."
      "Start: cd frontend ; claude"
    )
  }
  @{
    Title = "A3·Demo refresh"
    Path  = $BankWT
    Color = "Green"
    Brief = @(
      "Track: rewrite /demo and /demo/deep with the new pitchModel narrative."
      "Branch: bank-payment-layer. Files: src/app/demo/, src/data/demoNarrative.ts, demoDeep.ts"
      "Goals: align /demo with /pitch numbers, add live metrics row to /demo,"
      "  fill /demo/deep with architecture diagrams, threat model, perf budgets."
      "Start: cd frontend ; claude"
    )
  }
  @{
    Title = "A4·Multichat→live"
    Path  = $BankWT
    Color = "Magenta"
    Brief = @(
      "Track: take Multichat Engine from beta to live."
      "Branch: bank-payment-layer. Files: src/app/multichat-engine/, /api/qcoreai/chat"
      "Goals: parallel session UI, role isolation per agent, persistence,"
      "  white-label B2B preview, ship as a real consumable product surface."
      "Start: cd frontend ; claude"
    )
  }
  @{
    Title = "A5·Awards UX"
    Path  = $BankWT
    Color = "DarkYellow"
    Brief = @(
      "Track: real submission flow for Awards/Music + Awards/Film."
      "Branch: bank-payment-layer. Files: src/app/awards/{music,film}/, AwardPortal component"
      "Goals: submission form, vote UI, leaderboard with live Planet stats,"
      "  AEC payout preview tied to Bank, jury panel mechanics."
      "Start: cd frontend ; claude"
    )
  }

  # ───────── Group B — new tracks (each in its own worktree from main)
  @{
    Title = "B1·Globus polish"
    Path  = "$RepoRoot\frontend-globus"
    Color = "Cyan"
    Brief = @(
      "NEW track: rewrite the home page (the Globus / 27-node map) to wow investors."
      "Branch: globus-polish (forked from main). Worktree: frontend-globus/"
      "Goals: interactive 3D / SVG map, click any node → live status drawer,"
      "  hero refresh aligned with /pitch numbers, pull /api/globus/projects live."
      "First file to read: frontend/src/app/page.tsx (998 lines — careful)."
      "Start: cd frontend ; npm install --include=optional ; claude"
    )
  }
  @{
    Title = "B2·AEC Exchange"
    Path  = "$RepoRoot\frontend-exchange"
    Color = "Yellow"
    Brief = @(
      "NEW track: AEC internal exchange / liquidity engine."
      "Branch: aec-exchange. Worktree: frontend-exchange/"
      "Goals: design /exchange route — order book for AEC ↔ module-credit pairs"
      "  (royalty credit, chess credit, planet credit), AMM-style pricing,"
      "  treasury controls. Ship as preview behind feature flag."
      "Backend contracts to propose: /api/exchange/{book,quote,trade}."
      "Start: cd frontend ; npm install --include=optional ; claude"
    )
  }
  @{
    Title = "B3·Payments rail"
    Path  = "$RepoRoot\frontend-payments"
    Color = "Green"
    Brief = @(
      "NEW track: cross-module payments hardening (Bank ↔ QTrade ↔ Awards ↔ Planet)."
      "Branch: payments-rail. Worktree: frontend-payments/"
      "Goals: unified send-money primitive used by every module, settlement"
      "  audit log, recurring + scheduled + split + gift modes consolidated,"
      "  reconciliation report, real-time balance everywhere."
      "Files: src/app/bank/_components/SendForm.tsx, _lib/api.ts"
      "Start: cd frontend ; npm install --include=optional ; claude"
    )
  }
  @{
    Title = "B4·GTM (pricing+API docs)"
    Path  = "$RepoRoot\frontend-gtm"
    Color = "Magenta"
    Brief = @(
      "NEW track: investor-grade /pricing + /api-docs."
      "Branch: gtm-pricing-api. Worktree: frontend-gtm/"
      "Goals: tiered pricing page (Free / Pro / Enterprise) per module bundle,"
      "  hosted /api-docs reading from /api/openapi.json with try-it console,"
      "  partner program landing, embeds for iframe marketing."
      "Start: cd frontend ; npm install --include=optional ; claude"
    )
  }
  @{
    Title = "B5·Chess tournaments"
    Path  = "$RepoRoot\frontend-chess"
    Color = "DarkYellow"
    Brief = @(
      "NEW track: real CyberChess tournaments with AEC prize pools."
      "Branch: chess-tournaments. Worktree: frontend-chess/"
      "Goals: tournament creation, brackets, live spectating, AEC entry fees,"
      "  Trust-Score-gated brackets (elite-only), anti-cheat hooks via Trust Graph,"
      "  prize-pool auto-payout to Bank."
      "Files: src/app/cyberchess/page.tsx (1137 lines — read engine first)"
      "Start: cd frontend ; npm install --include=optional ; claude"
    )
  }
)

# ----------------------------------------------------------------------------
# Step 3. Open the 10 tabs/windows
# ----------------------------------------------------------------------------
$wtPath = (Get-Command wt.exe -ErrorAction SilentlyContinue)
$useWT  = $null -ne $wtPath

Write-Host "[2/3] Opening 10 sessions..." -ForegroundColor Yellow
if ($useWT) {
  Write-Host "      Using Windows Terminal (wt.exe) — single window, 10 tabs." -ForegroundColor Gray
} else {
  Write-Host "      Windows Terminal not found — falling back to 10 PowerShell windows." -ForegroundColor Gray
  Write-Host "      (Install Windows Terminal from Microsoft Store for a nicer experience.)" -ForegroundColor Gray
}
Write-Host ""

if ($useWT) {
  # Build a single wt.exe invocation with new-tab actions chained by `;`
  $wtArgs = @()
  $first = $true
  foreach ($s in $Sessions) {
    $cmd  = "Set-Location '$($s.Path)'; Write-Host '═══ $($s.Title) ═══' -ForegroundColor Cyan; "
    foreach ($line in $s.Brief) { $cmd += "Write-Host '  $line' -ForegroundColor Gray; " }
    $cmd += "Write-Host ''; Write-Host 'Ready. Type: claude' -ForegroundColor Green"
    if ($first) {
      $wtArgs += @("new-tab", "--title", "$($s.Title)", "-d", "$($s.Path)", "powershell.exe", "-NoExit", "-Command", "$cmd")
      $first = $false
    } else {
      $wtArgs += @(";", "new-tab", "--title", "$($s.Title)", "-d", "$($s.Path)", "powershell.exe", "-NoExit", "-Command", "$cmd")
    }
  }
  Start-Process wt.exe -ArgumentList $wtArgs
} else {
  foreach ($s in $Sessions) {
    $cmd = "Set-Location '$($s.Path)'; `$Host.UI.RawUI.WindowTitle = '$($s.Title)'; Write-Host '═══ $($s.Title) ═══' -ForegroundColor Cyan; "
    foreach ($line in $s.Brief) { $cmd += "Write-Host '  $line' -ForegroundColor Gray; " }
    $cmd += "Write-Host ''; Write-Host 'Ready. Type: claude' -ForegroundColor Green"
    Start-Process powershell -ArgumentList @("-NoExit", "-Command", $cmd) | Out-Null
  }
}

Write-Host ""
Write-Host "[3/3] Done." -ForegroundColor Green
Write-Host ""
Write-Host "Tip: each tab/window has its own brief and cwd ready. Type 'claude' to start." -ForegroundColor Cyan
Write-Host "     Read SESSIONS_README.md for the full plan and per-track first prompts." -ForegroundColor Cyan
Write-Host ""
