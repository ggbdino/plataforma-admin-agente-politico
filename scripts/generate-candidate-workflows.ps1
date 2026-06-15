param(
  [string]$ManifestPath = "",
  [switch]$SnapshotOnly,
  [switch]$CleanupLegacy
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$sourceDir = Join-Path (Split-Path -Parent $repoRoot) "workflows"
$snapshotDir = Join-Path $repoRoot "external-workflows-snapshot"

if ([string]::IsNullOrWhiteSpace($ManifestPath)) {
  $ManifestPath = Join-Path $repoRoot "scripts\\candidatos-workflows.json"
}

if (-not (Test-Path -LiteralPath $sourceDir)) {
  throw "Pasta de workflows não encontrada: $sourceDir"
}

if (-not (Test-Path -LiteralPath $snapshotDir)) {
  New-Item -ItemType Directory -Path $snapshotDir | Out-Null
}

if (-not (Test-Path -LiteralPath $ManifestPath)) {
  throw "Manifesto de candidatos não encontrado: $ManifestPath"
}

$candidates = Get-Content -LiteralPath $ManifestPath -Raw | ConvertFrom-Json
if (-not $candidates -or $candidates.Count -eq 0) {
  throw "Nenhum candidato definido no manifesto: $ManifestPath"
}

$templateFiles = @{
  "02a" = "02a_meta_webhook_verify_eri_1313.json"
  "02b" = "02b_funil_eleitor_eri_1313.json"
  "04b" = "04b_cadencia_eri_1313.json"
  "05b" = "05b_governanca_eri_1313.json"
  "06b" = "06_participacao_eventos_kpis.json"
  "07"  = "07_qrcode_canais_agentes_brunex.json"
}

foreach ($file in $templateFiles.Values) {
  $path = Join-Path $sourceDir $file
  if (-not (Test-Path -LiteralPath $path)) {
    throw "Template ausente: $path"
  }
}

function Write-Utf8NoBom([string]$Path, [string]$Content) {
  [System.IO.File]::WriteAllText($Path, $Content, [System.Text.UTF8Encoding]::new($false))
}

function Apply-CommonCandidateReplacements([string]$Content, $Candidate) {
  $suffix = "$($Candidate.slug)_$($Candidate.id)"
  $slugUnderscore = [string]$Candidate.slug_underscore
  if ([string]::IsNullOrWhiteSpace($slugUnderscore)) {
    $slugUnderscore = ([string]$Candidate.slug).Replace("-", "_")
  }

  $content = $Content
  $content = $content.Replace("eri_1313", $suffix)
  $content = $content.Replace("Eri 1313", "$($Candidate.nome) $($Candidate.id)")
  $content = $content.Replace("Eri Castro", [string]$Candidate.nome)
  $content = $content.Replace("eri-castro", [string]$Candidate.slug)
  $content = $content.Replace("/1313/", "/$($Candidate.id)/")
  $content = $content.Replace("'1313'", "'$($Candidate.id)'")
  $content = $content.Replace("cadencia_eri_1313", "cadencia_${slugUnderscore}_$($Candidate.id)")
  $content = $content.Replace("cadencia_webhook_eri", "cadencia_webhook_${slugUnderscore}")
  $content = $content.Replace("webhook_inbound_meta_eri", "webhook_inbound_meta_${slugUnderscore}")
  $content = $content.Replace("webhook_outbound_meta_eri", "webhook_outbound_meta_${slugUnderscore}")
  $content = $content.Replace("1313", [string]$Candidate.id)
  return $content
}

function Build-FlowName([string]$Prefix, $Candidate) {
  $slug = [string]$Candidate.slug
  $slugUnderscore = [string]$Candidate.slug_underscore
  if ([string]::IsNullOrWhiteSpace($slugUnderscore)) {
    $slugUnderscore = $slug.Replace("-", "_")
  }

  switch ($Prefix) {
    "02a" { return "02a_meta_webhook_verify_${slug}_$($Candidate.id)" }
    "02b" { return "02b_funil_eleitor_${slug}_$($Candidate.id)" }
    "04b" { return "04b_cadencia_${slug}_$($Candidate.id)" }
    "05b" { return "05b_governanca_${slug}_$($Candidate.id)" }
    "07"  { return "07_qrcode_canais_agentes_${slugUnderscore}_$($Candidate.id)" }
    "06b" { return "06b_participacao_eventos_${slugUnderscore}_$($Candidate.id)" }
    default { throw "Prefixo de fluxo não suportado no nome: $Prefix" }
  }
}

function Build-FlowContent([string]$Prefix, $TemplateContent, $Candidate) {
  $slugUnderscore = [string]$Candidate.slug_underscore
  if ([string]::IsNullOrWhiteSpace($slugUnderscore)) {
    $slugUnderscore = ([string]$Candidate.slug).Replace("-", "_")
  }

  switch ($Prefix) {
    "02a" { return Apply-CommonCandidateReplacements $TemplateContent $Candidate }
    "02b" { return Apply-CommonCandidateReplacements $TemplateContent $Candidate }
    "04b" { return Apply-CommonCandidateReplacements $TemplateContent $Candidate }
    "05b" { return Apply-CommonCandidateReplacements $TemplateContent $Candidate }
    "07" {
      $content = $TemplateContent
      $content = $content.Replace("07_qrcode_canais_agentes_brunex", "07_qrcode_canais_agentes_${slugUnderscore}_$($Candidate.id)")
      $content = $content.Replace("Brunex", [string]$Candidate.nome)
      $content = $content.Replace("brunex", [string]$Candidate.slug)
      $content = $content.Replace("/0001/", "/$($Candidate.id)/")
      $content = $content.Replace("'0001'", "'$($Candidate.id)'")
      $content = $content.Replace("0001", [string]$Candidate.id)
      return $content
    }
    "06b" {
      $content = $TemplateContent
      $content = $content.Replace("06_participacao_eventos_kpis", "06b_participacao_eventos_${slugUnderscore}_$($Candidate.id)")
      $content = $content.Replace("Webhook Participação Evento", "Webhook Participação Evento $($Candidate.nome) $($Candidate.id)")
      $content = $content.Replace("agente-politico/eventos/participacao", "agente-politico/$($Candidate.id)/eventos/participacao")
      $content = $content.Replace("agente-politico-eventos-participacao", "agente-politico-$($Candidate.id)-eventos-participacao")
      $content = $content.Replace("const idCandidato = String(b.id_candidato || '').trim();", "const idCandidato = '$($Candidate.id)';")
      $content = $content.Replace("where e.data_evento >= current_date - interval '90 days'", "where e.id_candidato = '$($Candidate.id)' and e.data_evento >= current_date - interval '90 days'")
      $content = $content.Replace("where p.data_confirmacao >= current_date - interval '90 days'", "where p.id_candidato = '$($Candidate.id)' and p.data_confirmacao >= current_date - interval '90 days'")
      return $content
    }
    default {
      throw "Prefixo de fluxo não suportado: $Prefix"
    }
  }
}

$written = @()
$legacyRemoved = @()

function Remove-LegacyGeneratedFiles([string]$DirectoryPath, $Candidates) {
  if (-not (Test-Path -LiteralPath $DirectoryPath)) {
    return @()
  }

  $removed = @()

  foreach ($candidate in $Candidates) {
    $slug = [string]$candidate.slug
    $legacyPrefixes = @("02a", "02b", "04b", "05b")

    foreach ($prefix in $legacyPrefixes) {
      $legacyPath = Join-Path $DirectoryPath "${prefix}_${slug}_$($candidate.id).json"
      if (Test-Path -LiteralPath $legacyPath) {
        Remove-Item -LiteralPath $legacyPath -Force
        $removed += $legacyPath
      }
    }
  }

  return $removed
}

if ($CleanupLegacy) {
  if (-not $SnapshotOnly) {
    $legacyRemoved += Remove-LegacyGeneratedFiles -DirectoryPath $sourceDir -Candidates $candidates
  }
  $legacyRemoved += Remove-LegacyGeneratedFiles -DirectoryPath $snapshotDir -Candidates $candidates
}

foreach ($candidate in $candidates) {
  foreach ($prefix in @("02a", "02b", "04b", "05b", "06b", "07")) {
    $templateName = $templateFiles[$prefix]
    $templatePath = Join-Path $sourceDir $templateName
    $templateContent = Get-Content -LiteralPath $templatePath -Raw
    $targetName = "$(Build-FlowName $prefix $candidate).json"
    $generatedContent = Build-FlowContent $prefix $templateContent $candidate

    if (-not $SnapshotOnly) {
      $destSource = Join-Path $sourceDir $targetName
      Write-Utf8NoBom $destSource $generatedContent
      $written += $destSource
    }

    $destSnapshot = Join-Path $snapshotDir $targetName
    Write-Utf8NoBom $destSnapshot $generatedContent
    $written += $destSnapshot
  }
}

$legacyRemoved | Sort-Object | ForEach-Object { "REMOVED_LEGACY=$_" }
$written | Sort-Object | ForEach-Object { "GENERATED=$_" }
