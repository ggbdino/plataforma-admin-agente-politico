$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$sourceDir = Join-Path (Split-Path -Parent $repoRoot) "workflows"
$targetDir = Join-Path $repoRoot "external-workflows-snapshot"

if (-not (Test-Path -LiteralPath $sourceDir)) {
  throw "Pasta de origem nao encontrada: $sourceDir"
}

if (-not (Test-Path -LiteralPath $targetDir)) {
  New-Item -ItemType Directory -Path $targetDir | Out-Null
}

Get-ChildItem -LiteralPath $sourceDir -Filter *.json -File | ForEach-Object {
  $destination = Join-Path $targetDir $_.Name
  Copy-Item -LiteralPath $_.FullName -Destination $destination -Force
}

Write-Output "SNAPSHOT_OK=$targetDir"
