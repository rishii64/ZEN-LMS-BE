# PostgreSQL Backup Script (Windows PowerShell)
param(
  [string]$DatabaseUrl = $env:DATABASE_URL,
  [string]$OutputDir = ".\database\backups"
)

if (-not $DatabaseUrl) {
  Write-Error "DATABASE_URL is not set. Pass -DatabaseUrl or set `$env:DATABASE_URL."
  exit 1
}

New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null
$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$outFile = Join-Path $OutputDir "lms_backup_$timestamp.sql"

$pgDump = "C:\Program Files\PostgreSQL\18\bin\pg_dump.exe"
if (-not (Test-Path $pgDump)) { $pgDump = "pg_dump" }

& $pgDump --dbname="$DatabaseUrl" --clean --if-exists --no-owner --file="$outFile"
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
Write-Host "Backup created at $outFile"
