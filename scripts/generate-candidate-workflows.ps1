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

$candidates = [System.IO.File]::ReadAllText($ManifestPath, [System.Text.Encoding]::UTF8) | ConvertFrom-Json
if (-not $candidates -or $candidates.Count -eq 0) {
  throw "Nenhum candidato definido no manifesto: $ManifestPath"
}

$templateFiles = @{
  "02a" = "02a_meta_webhook_verify_eri_1313.json"
  "02b" = "02b_funil_eleitor_eri_1313.json"
  "02b_datafy" = "02b_funil_eleitor_ricardo-vale_ricardo-vale_datafy-chat.json"
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
    "02b_datafy" { return "02b_funil_eleitor_${slug}_$($Candidate.id)_datafy-chat" }
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
    "02b_datafy" { return Apply-DatafyCandidateReplacements $TemplateContent $Candidate }
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

function Apply-DatafyCandidateReplacements([string]$Content, $Candidate) {
  $slug = [string]$Candidate.slug
  $slugUnderscore = [string]$Candidate.slug_underscore
  if ([string]::IsNullOrWhiteSpace($slugUnderscore)) {
    $slugUnderscore = $slug.Replace("-", "_")
  }

  $nome = [string]$Candidate.nome
  $nomeLower = $nome.ToLowerInvariant()
  $id = [string]$Candidate.id
  $targetName = "02b_funil_eleitor_${slug}_$($Candidate.id)_datafy-chat"
  $genericIncrementalBlock = @(
    "'DETALHAMENTO INCREMENTAL DO CANDIDATO - EDITAVEL NO WORKFLOW, SEM ALTERAR O BANCO:',",
    "'Use este bloco apenas como complemento manual. Para este candidato, priorize perfil_markdown, prompts_agentes e dados da base. Nunca invente propostas, links, apoios ou realizacoes.',",
    "'ROTEIRO INICIAL: no primeiro contato, apresente-se como Atendente Virtual de $nome e pergunte o nome do eleitor. Depois de receber o nome, ofereca as opcoes: 1 - Conhecer $nome 2 - Acompanhar o trabalho 3 - Redes sociais 4 - Falar comigo 5 - Receber materiais.',",
    "'Quando faltar informacao sobre uma proposta, diga que a proposta ainda esta sendo consolidada com a populacao.',",
    "'ABERTURA DO DIA:',"
  ) -join "\n"

  $content = $Content
  $content = $content -replace "(?s)'DETALHAMENTO INCREMENTAL DO CANDIDATO.*?'ABERTURA DO DIA:',", $genericIncrementalBlock
  $content = $content.Replace("02b_funil_eleitor_ricardo-vale_ricardo-vale_datafy-chat", $targetName)
  $content = $content.Replace("Webhook Entrada Ricardo Vale Datafy POST", "Webhook Entrada $nome Datafy POST")
  $content = $content.Replace("agente-politico/ricardo-vale/entrada-eleitor-datafy", "agente-politico/$id/entrada-eleitor-datafy")
  $content = $content.Replace("agente-politico-ricardo-vale-entrada-eleitor-datafy-post", "agente-politico-$id-entrada-eleitor-datafy-post")
  $content = $content.Replace("Postgres_Buscar_Contexto_Datafy_Ricardo", "Postgres_Buscar_Contexto_Datafy_$slugUnderscore")
  $content = $content.Replace("Merge_Contexto_Datafy_Ricardo", "Merge_Contexto_Datafy_$slugUnderscore")
  $content = $content.Replace("webhook_inbound_datafy_ricardo_vale", "webhook_inbound_datafy_$slugUnderscore")
  $content = $content.Replace("webhook_outbound_datafy_ricardo_vale", "webhook_outbound_datafy_$slugUnderscore")
  $content = $content -replace "quem.{1,4}ricardo vale", "quem e $nomeLower"
  $content = $content.Replace("fala do ricardo", "fala de $nomeLower")
  $content = $content.Replace("fala de ricardo vale", "fala de $nomeLower")
  $content = $content.Replace("me fala do ricardo", "me fala de $nomeLower")
  $content = $content.Replace("me fala de ricardo vale", "me fala de $nomeLower")
  $content = $content -replace "'13\. Nunca responda que o Instagram.*?ricardovaledf/\.',", "'13. Quando perguntarem por redes sociais, responda apenas com links ou perfis que estejam no perfil, prompts ou dados cadastrados do candidato. Se nao houver link cadastrado, diga que a equipe esta atualizando os canais oficiais.',"
  $content = $content.Replace("Ricardo Vale", $nome)
  $content = $content.Replace("ricardo-vale", $id)
  $content = $content.Replace("ricardo_vale", $slugUnderscore)
  return $content
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
  foreach ($prefix in @("02a", "02b", "02b_datafy", "04b", "05b", "06b", "07")) {
    $templateName = $templateFiles[$prefix]
    $templatePath = Join-Path $sourceDir $templateName
    $templateContent = [System.IO.File]::ReadAllText($templatePath, [System.Text.Encoding]::UTF8)
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
