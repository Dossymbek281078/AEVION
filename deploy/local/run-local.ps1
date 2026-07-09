<#
  AEVION QCoreAI - one-command OFFLINE launcher (Windows / PowerShell).

  Brings up the Council so it runs with the internet OFF:
    1. checks a local runtime (Ollama by default) is reachable,
    2. pulls a few small, diverse models (skips ones already present),
    3. writes backend .env + frontend .env.local pointing at localhost,
    4. starts backend + frontend (npm run dev).

  Usage (from the repo root, aevion-core):
    powershell -ExecutionPolicy Bypass -File deploy\local\run-local.ps1

  Options:
    -Models "llama3.2,qwen2.5:7b,gemma2:2b"   # override the model set
    -OllamaUrl "http://127.0.0.1:11434"       # non-default host/port
    -NoPull                                    # skip model pulls
    -NoStart                                   # write env only, don't launch
#>
param(
  [string]$Models = "llama3.2,qwen2.5:7b,gemma2:2b",
  [string]$OllamaUrl = "http://127.0.0.1:11434",
  [switch]$NoPull,
  [switch]$NoStart
)

$ErrorActionPreference = "Stop"
$repo = Resolve-Path (Join-Path $PSScriptRoot "..\..")
Write-Host "AEVION offline launcher - repo: $repo" -ForegroundColor Cyan

# 1. Ollama reachable?
$ollamaOk = $false
try {
  Invoke-RestMethod -Uri "$OllamaUrl/api/tags" -TimeoutSec 4 | Out-Null
  $ollamaOk = $true
  Write-Host "[ok] Ollama is running at $OllamaUrl" -ForegroundColor Green
} catch {
  Write-Host "[!] Ollama not reachable at $OllamaUrl" -ForegroundColor Yellow
  if (Get-Command ollama -ErrorAction SilentlyContinue) {
    Write-Host "    Starting 'ollama serve' in a new window..." -ForegroundColor Yellow
    Start-Process -WindowStyle Minimized ollama -ArgumentList "serve"
    Start-Sleep -Seconds 3
    try { Invoke-RestMethod -Uri "$OllamaUrl/api/tags" -TimeoutSec 4 | Out-Null; $ollamaOk = $true; Write-Host "[ok] Ollama started" -ForegroundColor Green } catch {}
  } else {
    Write-Host "    Install Ollama from https://ollama.com, then re-run this script." -ForegroundColor Yellow
    Write-Host "    (Or use LM Studio / Jan and set its *_BASE_URL in aevion-globus-backend\.env instead.)" -ForegroundColor Yellow
  }
}

# 2. Pull models.
$modelList = $Models.Split(",") | ForEach-Object { $_.Trim() } | Where-Object { $_ }
if ($ollamaOk -and -not $NoPull) {
  foreach ($m in $modelList) {
    Write-Host "[pull] $m" -ForegroundColor Cyan
    & ollama pull $m
  }
} elseif ($NoPull) {
  Write-Host "[skip] model pull (-NoPull)" -ForegroundColor DarkGray
}
$firstModel = if ($modelList.Count -gt 0) { $modelList[0] } else { "llama3.2" }

# 3. Write env files.
$backendEnv = Join-Path $repo "aevion-globus-backend\.env"
$frontendEnv = Join-Path $repo "frontend\.env.local"

$backendLines = @(
  "# Written by deploy/local/run-local.ps1 - OFFLINE preset",
  "OLLAMA_BASE_URL=$OllamaUrl/v1",
  "OLLAMA_MODEL=$firstModel",
  "PORT=4001"
)
# Preserve any existing non-managed backend .env lines (keys, DATABASE_URL, ...).
if (Test-Path $backendEnv) {
  $managed = @("OLLAMA_BASE_URL=", "OLLAMA_MODEL=", "PORT=")
  $kept = Get-Content $backendEnv | Where-Object {
    $line = $_.Trim()
    if ($line -match "Written by deploy/local") { return $false }
    foreach ($pfx in $managed) { if ($line.StartsWith($pfx)) { return $false } }
    return $true
  }
  $backendLines = $backendLines + $kept
}
$backendLines | Set-Content -Encoding utf8 $backendEnv
Write-Host "[env] wrote $backendEnv" -ForegroundColor Green

"BACKEND_PROXY_TARGET=http://127.0.0.1:4001" | Set-Content -Encoding utf8 $frontendEnv
Write-Host "[env] wrote $frontendEnv" -ForegroundColor Green

# 4. Launch.
if ($NoStart) {
  Write-Host "`nEnv ready. Start manually with:  npm run dev   (from $repo)" -ForegroundColor Cyan
  Write-Host "Then open http://localhost:3000/qcoreai/multi, pick Council, toggle 'Offline (local)'." -ForegroundColor Cyan
  exit 0
}

Write-Host "`nStarting backend + frontend (npm run dev)..." -ForegroundColor Cyan
Write-Host "When up: http://localhost:3000/qcoreai/multi -> Council -> toggle 'Offline (local)'." -ForegroundColor Cyan
Set-Location $repo
& npm run dev
