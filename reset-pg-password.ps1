# reset-pg-password.ps1
# ЗАПУСКАТЬ ИЗ POWERSHELL ОТ ИМЕНИ АДМИНИСТРАТОРА.
# Сбрасывает пароль postgres на '28112019' через временный trust в pg_hba.conf.

$ErrorActionPreference = "Stop"

$pgBase = "C:\Program Files\PostgreSQL\18"
$pgData = "$pgBase\data"
$hba    = "$pgData\pg_hba.conf"
$psql   = "$pgBase\bin\psql.exe"
$svc    = "postgresql-x64-18"
$backup = "$hba.bak-reset"

if (-not (Test-Path $hba))  { throw "pg_hba.conf не найден: $hba" }
if (-not (Test-Path $psql)) { throw "psql.exe не найден: $psql" }

Write-Host "[1/6] backup pg_hba.conf -> $backup"
Copy-Item $hba $backup -Force

Write-Host "[2/6] set localhost lines to 'trust' (temporary)"
$lines = Get-Content $hba | ForEach-Object {
    $_ -replace '^(host\s+all\s+all\s+127\.0\.0\.1/32\s+)\S+', '${1}trust' `
       -replace '^(host\s+all\s+all\s+::1/128\s+)\S+',        '${1}trust'
}
[System.IO.File]::WriteAllLines($hba, $lines, (New-Object System.Text.UTF8Encoding $false))

Write-Host "[3/6] restart $svc"
Restart-Service $svc
Start-Sleep -Seconds 3

Write-Host "[4/6] ALTER USER postgres WITH PASSWORD '28112019'"
$env:PGPASSWORD = ""
& $psql -U postgres -h 127.0.0.1 -d postgres -c "ALTER USER postgres WITH PASSWORD '28112019';"
if ($LASTEXITCODE -ne 0) {
    Write-Host "ALTER failed, restoring pg_hba.conf"
    Copy-Item $backup $hba -Force
    Restart-Service $svc
    throw "psql ALTER USER failed with exit code $LASTEXITCODE"
}

Write-Host "[5/6] restore original pg_hba.conf"
Copy-Item $backup $hba -Force

Write-Host "[6/6] restart $svc"
Restart-Service $svc
Start-Sleep -Seconds 2

Write-Host ""
Write-Host "DONE. Пароль postgres сброшен на '28112019'." -ForegroundColor Green
Write-Host "Backup: $backup (можно удалить после проверки)" -ForegroundColor Yellow
