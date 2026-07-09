<#
  Stage the built backend + frontend into desktop/resources/ so electron-builder
  can bundle them. Run this before `npm run dist`.

  Steps:
    1. build the backend  (aevion-globus-backend: npm run build -> dist/)
    2. build the frontend (frontend: npm run build -> .next/)
    3. copy the runtime pieces into resources/backend and resources/frontend

  Usage (from desktop/):
    powershell -ExecutionPolicy Bypass -File stage-resources.ps1
    ...\stage-resources.ps1 -SkipBuild     # copy only, reuse existing builds
#>
param(
  [switch]$SkipBuild
)

$ErrorActionPreference = "Stop"
$here = $PSScriptRoot
$repo = Resolve-Path (Join-Path $here "..")
$backendSrc = Join-Path $repo "aevion-globus-backend"
$frontendSrc = Join-Path $repo "frontend"
$resources = Join-Path $here "resources"
$backendDst = Join-Path $resources "backend"
$frontendDst = Join-Path $resources "frontend"

Write-Host "AEVION Council - staging resources" -ForegroundColor Cyan
Write-Host "  repo: $repo" -ForegroundColor DarkGray

if (-not $SkipBuild) {
  Write-Host "[build] backend (npm run build)" -ForegroundColor Cyan
  Push-Location $backendSrc; & npm run build; Pop-Location
  Write-Host "[build] frontend (npm run build)" -ForegroundColor Cyan
  Push-Location $frontendSrc; & npm run build; Pop-Location
}

# Reset destination.
if (Test-Path $resources) { Remove-Item -Recurse -Force $resources }
New-Item -ItemType Directory -Force -Path $backendDst | Out-Null
New-Item -ItemType Directory -Force -Path $frontendDst | Out-Null

function Copy-Item-IfExists($src, $dst) {
  if (Test-Path $src) {
    Write-Host "  + $(Split-Path $src -Leaf)" -ForegroundColor DarkGray
    Copy-Item -Recurse -Force $src $dst
  } else {
    Write-Host "  - missing (skipped): $src" -ForegroundColor Yellow
  }
}

# Backend runtime pieces.
Write-Host "[stage] backend -> resources/backend" -ForegroundColor Cyan
Copy-Item-IfExists (Join-Path $backendSrc "dist") $backendDst
Copy-Item-IfExists (Join-Path $backendSrc "node_modules") $backendDst
Copy-Item-IfExists (Join-Path $backendSrc "package.json") $backendDst
Copy-Item-IfExists (Join-Path $backendSrc "prisma") $backendDst

# Frontend runtime pieces. If a standalone build exists (output: "standalone"),
# that folder alone is enough and much smaller; otherwise stage for `next start`.
Write-Host "[stage] frontend -> resources/frontend" -ForegroundColor Cyan
$standalone = Join-Path $frontendSrc ".next\standalone"
if (Test-Path $standalone) {
  Write-Host "  (standalone build detected - staging lean)" -ForegroundColor Green
  Copy-Item -Recurse -Force (Join-Path $frontendSrc ".next") $frontendDst
  Copy-Item-IfExists (Join-Path $frontendSrc "public") $frontendDst
} else {
  Write-Host "  (no standalone - staging .next + node_modules for 'next start')" -ForegroundColor Yellow
  Copy-Item-IfExists (Join-Path $frontendSrc ".next") $frontendDst
  Copy-Item-IfExists (Join-Path $frontendSrc "node_modules") $frontendDst
  Copy-Item-IfExists (Join-Path $frontendSrc "public") $frontendDst
  Copy-Item-IfExists (Join-Path $frontendSrc "package.json") $frontendDst
  Copy-Item-IfExists (Join-Path $frontendSrc "next.config.ts") $frontendDst
}

Write-Host "`nStaged. Next: npm run dist  (produces out/AEVION-Council-Setup-*.exe)" -ForegroundColor Green
