# PostgreSQL Restore Script (Windows PowerShell)
param(
  [Parameter(Mandatory=$true)][string]$BackupFile,
  [string]$DatabaseUrl = $env:DATABASE_URL
)

if (-not $DatabaseUrl) {
  Write-Error "DATABASE_URL is not set."
  exit 1
}

$psql = "C:\Program Files\PostgreSQL\18\bin\psql.exe"
if (-not (Test-Path $psql)) { $psql = "psql" }

& $psql --dbname="$DatabaseUrl" --file="$BackupFile"
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
Write-Host "Database restored from $BackupFile"
