<#
  AEVION QCoreAI - ZERO-SETUP offline agent launcher (Windows / PowerShell).

  Difference from run-local.ps1: this ALWAYS gives you a working offline agent.
    - If a local runtime is found (Ollama / LM Studio / Jan / LocalAI), it runs
      the real multi-agent pipeline against local models, internet OFF.
    - If NOTHING local is installed, it falls back to STUB mode
      (QCOREAI_STUB=1): the whole pipeline - Council AND Debate - still runs
      end-to-end with canned model output, no network, no API keys, no install.
      You get a clickable, working agent immediately; swap in Ollama later for
      real answers.

  Both online and OFFLINE debate produce ONE combined moderator verdict
  (Analyst -> Pro || Con -> Moderator).

  Usage (from the repo root, aevion-core):
    powershell -ExecutionPolicy Bypass -File deploy\local\run-offline-agent.ps1

  Options:
    -Stub          Force STUB mode even if a local runtime is present (fast demo).
    -Models "..."  Ollama model set (default: llama3.2,qwen2.5:7b,gemma2:2b).
    -NoStart       Write env only, don't launch.
#>
param(
  [switch]$Stub,
  [string]$Models = "llama3.2,qwen2.5:7b,gemma2:2b",
  [switch]$NoStart
)

$ErrorActionPreference = "Stop"
$repo = Resolve-Path (Join-Path $PSScriptRoot "..\..")
Write-Host "AEVION offline agent - repo: $repo" -ForegroundColor Cyan

# 1. Probe common local runtimes (OpenAI-compatible endpoints).
$runtimes = @(
  @{ Name = "Ollama";    Tags = "http://127.0.0.1:11434/api/tags"; Base = "http://127.0.0.1:11434/v1"; Env = "OLLAMA_BASE_URL" },
  @{ Name = "LM Studio"; Tags = "http://127.0.0.1:1234/v1/models"; Base = "http://127.0.0.1:1234/v1";  Env = "LMSTUDIO_BASE_URL" },
  @{ Name = "Jan";       Tags = "http://127.0.0.1:1337/v1/models"; Base = "http://127.0.0.1:1337/v1";  Env = "JAN_BASE_URL" },
  @{ Name = "LocalAI";   Tags = "http://127.0.0.1:8080/v1/models"; Base = "http://127.0.0.1:8080/v1";  Env = "LOCALAI_BASE_URL" }
)

$found = $null
if (-not $Stub) {
  foreach ($rt in $runtimes) {
    try {
      Invoke-RestMethod -Uri $rt.Tags -TimeoutSec 3 | Out-Null
      $found = $rt
      Write-Host "[ok] found local runtime: $($rt.Name) at $($rt.Base)" -ForegroundColor Green
      break
    } catch { }
  }
  # Ollama installed but not serving? start it.
  if (-not $found -and (Get-Command ollama -ErrorAction SilentlyContinue)) {
    Write-Host "[..] Ollama installed but not serving - starting 'ollama serve'..." -ForegroundColor Yellow
    Start-Process -WindowStyle Minimized ollama -ArgumentList "serve"
    Start-Sleep -Seconds 3
    try {
      Invoke-RestMethod -Uri $runtimes[0].Tags -TimeoutSec 4 | Out-Null
      $found = $runtimes[0]
      Write-Host "[ok] Ollama started" -ForegroundColor Green
    } catch { }
  }
}

# 2. Decide mode + write backend .env.
$backendEnv  = Join-Path $repo "aevion-globus-backend\.env"
$frontendEnv = Join-Path $repo "frontend\.env.local"

if ($found) {
  # Real offline mode against a local runtime.
  $mode = "LOCAL ($($found.Name))"
  $modelList = $Models.Split(",") | ForEach-Object { $_.Trim() } | Where-Object { $_ }
  if ($found.Name -eq "Ollama") {
    foreach ($m in $modelList) { Write-Host "[pull] $m" -ForegroundColor Cyan; & ollama pull $m }
  }
  $firstModel = if ($modelList.Count -gt 0) { $modelList[0] } else { "llama3.2" }
  $managed = @("$($found.Env)=", "OLLAMA_MODEL=", "QCOREAI_STUB=", "PORT=")
  $newLines = @(
    "# Written by deploy/local/run-offline-agent.ps1 - OFFLINE preset ($mode)",
    "$($found.Env)=$($found.Base)",
    "OLLAMA_MODEL=$firstModel",
    "PORT=4001"
  )
} else {
  # Zero-setup fallback: stub is marked local:true, so Council AND Debate run
  # fully offline with no network and no models installed.
  $mode = "STUB (no local runtime found - canned output, zero setup)"
  $managed = @("QCOREAI_STUB=", "QCOREAI_STUB_DELAY=", "PORT=")
  $newLines = @(
    "# Written by deploy/local/run-offline-agent.ps1 - OFFLINE preset ($mode)",
    "QCOREAI_STUB=1",
    "QCOREAI_STUB_DELAY=0",
    "PORT=4001"
  )
  Write-Host "[!] No local runtime found - starting in STUB mode." -ForegroundColor Yellow
  Write-Host "    Agent works offline right now (canned answers)." -ForegroundColor Yellow
  Write-Host "    For real local answers: install Ollama (https://ollama.com) and re-run." -ForegroundColor Yellow
}

# Preserve unmanaged existing lines (keys, DATABASE_URL, other runtimes).
if (Test-Path $backendEnv) {
  $kept = Get-Content $backendEnv | Where-Object {
    $line = $_.Trim()
    if ($line -match "Written by deploy/local") { return $false }
    foreach ($pfx in $managed) { if ($line.StartsWith($pfx)) { return $false } }
    return $true
  }
  $newLines = $newLines + $kept
}
$newLines | Set-Content -Encoding utf8 $backendEnv
Write-Host "[env] wrote $backendEnv  ($mode)" -ForegroundColor Green

"BACKEND_PROXY_TARGET=http://127.0.0.1:4001" | Set-Content -Encoding utf8 $frontendEnv
Write-Host "[env] wrote $frontendEnv" -ForegroundColor Green

# 3. Launch.
$where = "http://localhost:3000/qcoreai/multi"
if ($NoStart) {
  Write-Host "`nEnv ready ($mode). Start manually:  npm run dev   (from $repo)" -ForegroundColor Cyan
  Write-Host "Then open $where -> pick 'Debate' -> toggle 'Offline (local)'." -ForegroundColor Cyan
  Write-Host "You get ONE combined moderator verdict, fully offline." -ForegroundColor Cyan
  exit 0
}

Write-Host "`nStarting backend + frontend (npm run dev)... mode: $mode" -ForegroundColor Cyan
Write-Host "When up: $where -> 'Debate' -> toggle 'Offline (local)' -> one combined verdict." -ForegroundColor Cyan
Set-Location $repo
& npm run dev
