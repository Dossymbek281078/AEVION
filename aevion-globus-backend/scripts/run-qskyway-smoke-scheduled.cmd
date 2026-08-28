@echo off
REM Daily local QSkyway smoke (write paths -- cannot run against prod).
REM Comments here are ASCII ON PURPOSE: cmd.exe reads .cmd files in the OEM
REM codepage, so UTF-8 Cyrillic turns into garbage AND some of that garbage is
REM executed as commands. Cost me one failed run to learn. Russian explanation
REM lives in docs/OPS_CI_AND_SMOKE.md, section 4.
REM
REM What this fixes vs the old inline task command:
REM   SMOKE_START_TIMEOUT_MS -- 120s is not enough to boot ts-node-dev while
REM     other sessions build (8 concurrent builds seen on 2026-08-21). The
REM     failure looked like "run did not happen" although the code was fine.
REM   DATABASE_URL -- without it the smoke takes the "database unavailable"
REM     path and checks something other than what it exists for. Taken from
REM     smoke-db-setup.mjs at runtime so no password sits in the task definition.

setlocal
cd /d "%~dp0.."

set SMOKE_START_TIMEOUT_MS=420000

for /f "usebackq delims=" %%u in (`node scripts\smoke-db-setup.mjs --print-url`) do set DATABASE_URL=%%u

if "%DATABASE_URL%"=="" (
  echo [scheduled] could not resolve database url -- run did NOT happen
  exit /b 2
)

node scripts\smoke-report-on-fail.mjs
exit /b %ERRORLEVEL%
