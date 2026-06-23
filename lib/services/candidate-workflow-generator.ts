import { promises as fs } from "node:fs";
import path from "node:path";

type CandidateWorkflowManifestEntry = {
  id: string;
  nome: string;
  slug: string;
  slug_underscore: string;
};

type CandidateWorkflowGenerationInput = {
  id: string;
  nome: string;
};

type GeneratedWorkflowFile = {
  fileName: string;
  workflowCode: string;
};

export type CandidateWorkflowGenerationResult = {
  candidate: CandidateWorkflowManifestEntry;
  generatedFiles: GeneratedWorkflowFile[];
  manifestPath: string;
  workflowsDir: string;
  snapshotDir: string;
  templateDir: string;
};

const TEMPLATE_FILES: Record<string, string> = {
  "02a": "02a_meta_webhook_verify_eri_1313.json",
  "02b": "02b_funil_eleitor_eri_1313.json",
  "02b_datafy": "02b_funil_eleitor_ricardo-vale_ricardo-vale_datafy-chat.json",
  "04b": "04b_cadencia_eri_1313.json",
  "05b": "05b_governanca_eri_1313.json",
  "06b": "06_participacao_eventos_kpis.json",
  "07": "07_qrcode_canais_agentes_brunex.json"
};

const LEGACY_PREFIXES = ["02a", "02b", "04b", "05b"] as const;
const GENERATION_PREFIXES = ["02a", "02b", "02b_datafy", "04b", "05b", "06b", "07"] as const;

export async function generateCandidateWorkflowBundle(
  input: CandidateWorkflowGenerationInput
): Promise<CandidateWorkflowGenerationResult> {
  const appRoot = await resolveApplicationRoot();
  const snapshotDir = path.resolve(appRoot, "external-workflows-snapshot");
  const manifestPath = path.resolve(appRoot, "scripts", "candidatos-workflows.json");
  const preferredWorkflowsDir = path.resolve(appRoot, "..", "workflows");
  const workflowsDir = (await pathExists(preferredWorkflowsDir))
    ? preferredWorkflowsDir
    : snapshotDir;
  const templateDir = (await pathExists(preferredWorkflowsDir))
    ? preferredWorkflowsDir
    : snapshotDir;

  await fs.mkdir(snapshotDir, { recursive: true });
  await fs.mkdir(workflowsDir, { recursive: true });
  await ensurePathExists(templateDir, "Pasta de templates de workflows nao encontrada");
  await ensurePathExists(manifestPath, "Manifesto de candidatos nao encontrado");

  const candidate = buildManifestEntry(input);
  const manifest = await upsertCandidateManifest(manifestPath, candidate);

  await cleanupLegacyGeneratedFiles(workflowsDir, manifest);
  await cleanupLegacyGeneratedFiles(snapshotDir, manifest);

  const generatedFiles: GeneratedWorkflowFile[] = [];

  for (const prefix of GENERATION_PREFIXES) {
    const templateName = TEMPLATE_FILES[prefix];
    const templatePath = path.resolve(templateDir, templateName);
    await ensurePathExists(templatePath, "Template de workflow ausente");

    const templateContent = await fs.readFile(templatePath, "utf8");
    const fileName = `${buildFlowName(prefix, candidate)}.json`;
    const generatedContent = buildFlowContent(prefix, templateContent, candidate);

    await fs.writeFile(path.resolve(workflowsDir, fileName), generatedContent, "utf8");
    await fs.writeFile(path.resolve(snapshotDir, fileName), generatedContent, "utf8");

    generatedFiles.push({
      fileName,
      workflowCode: prefix
    });
  }

  return {
    candidate,
    generatedFiles,
    manifestPath,
    workflowsDir,
    snapshotDir,
    templateDir
  };
}

async function resolveApplicationRoot() {
  const candidates = [
    process.cwd(),
    path.resolve(process.cwd(), "plataforma-admin"),
    path.resolve(process.cwd(), "..", "plataforma-admin"),
    path.resolve(process.cwd(), ".next", "standalone", "plataforma-admin")
  ];

  for (const candidatePath of candidates) {
    if (await hasApplicationMarkers(candidatePath)) {
      return candidatePath;
    }
  }

  throw new Error(
    `Nao foi possivel localizar a raiz da aplicacao para gerar workflows. CWD atual: ${process.cwd()}`
  );
}

async function hasApplicationMarkers(candidatePath: string) {
  const packageJsonPath = path.resolve(candidatePath, "package.json");
  const scriptsPath = path.resolve(candidatePath, "scripts", "candidatos-workflows.json");
  const snapshotPath = path.resolve(candidatePath, "external-workflows-snapshot");

  return (
    (await pathExists(packageJsonPath)) &&
    (await pathExists(scriptsPath)) &&
    (await pathExists(snapshotPath))
  );
}

async function pathExists(targetPath: string) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function ensurePathExists(targetPath: string, errorPrefix: string) {
  if (!(await pathExists(targetPath))) {
    throw new Error(`${errorPrefix}: ${targetPath}`);
  }
}

function buildManifestEntry(input: CandidateWorkflowGenerationInput): CandidateWorkflowManifestEntry {
  const id = String(input.id).trim();
  const nome = String(input.nome).trim();

  if (!id || !nome) {
    throw new Error("Nao foi possivel gerar os workflows: candidato sem identificador ou nome.");
  }

  const slug = normalizeForSlug(nome || id);
  const slugUnderscore = slug.replace(/-/g, "_");

  return {
    id,
    nome,
    slug,
    slug_underscore: slugUnderscore
  };
}

async function upsertCandidateManifest(
  manifestPath: string,
  candidate: CandidateWorkflowManifestEntry
) {
  const raw = await fs.readFile(manifestPath, "utf8");
  const parsed = JSON.parse(raw) as CandidateWorkflowManifestEntry[];

  const next = parsed.filter((entry) => entry.id !== candidate.id);
  next.push(candidate);
  next.sort((left, right) => left.nome.localeCompare(right.nome, "pt-BR"));

  await fs.writeFile(manifestPath, `${JSON.stringify(next, null, 2)}\n`, "utf8");
  return next;
}

async function cleanupLegacyGeneratedFiles(
  directoryPath: string,
  candidates: CandidateWorkflowManifestEntry[]
) {
  for (const candidate of candidates) {
    for (const prefix of LEGACY_PREFIXES) {
      const legacyFileName = `${prefix}_${candidate.slug}_${candidate.id}.json`;
      const legacyPath = path.resolve(directoryPath, legacyFileName);

      try {
        await fs.unlink(legacyPath);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
          throw error;
        }
      }
    }
  }
}

function buildFlowName(prefix: string, candidate: CandidateWorkflowManifestEntry) {
  switch (prefix) {
    case "02a":
      return `02a_meta_webhook_verify_${candidate.slug}_${candidate.id}`;
    case "02b":
      return `02b_funil_eleitor_${candidate.slug}_${candidate.id}`;
    case "02b_datafy":
      return `02b_funil_eleitor_${candidate.slug}_${candidate.id}_datafy-chat`;
    case "04b":
      return `04b_cadencia_${candidate.slug}_${candidate.id}`;
    case "05b":
      return `05b_governanca_${candidate.slug}_${candidate.id}`;
    case "06b":
      return `06b_participacao_eventos_${candidate.slug_underscore}_${candidate.id}`;
    case "07":
      return `07_qrcode_canais_agentes_${candidate.slug_underscore}_${candidate.id}`;
    default:
      throw new Error(`Prefixo de workflow nao suportado: ${prefix}`);
  }
}

function buildFlowContent(
  prefix: string,
  templateContent: string,
  candidate: CandidateWorkflowManifestEntry
) {
  switch (prefix) {
    case "02a":
    case "02b":
    case "04b":
    case "05b":
      return applyCommonCandidateReplacements(templateContent, candidate);
    case "02b_datafy":
      return applyDatafyCandidateReplacements(templateContent, candidate);
    case "06b":
      return templateContent
        .replace(
          "06_participacao_eventos_kpis",
          `06b_participacao_eventos_${candidate.slug_underscore}_${candidate.id}`
        )
        .replace(
          "Webhook Participação Evento",
          `Webhook Participação Evento ${candidate.nome} ${candidate.id}`
        )
        .replace(
          "agente-politico/eventos/participacao",
          `agente-politico/${candidate.id}/eventos/participacao`
        )
        .replace(
          "agente-politico-eventos-participacao",
          `agente-politico-${candidate.id}-eventos-participacao`
        )
        .replace(
          "const idCandidato = String(b.id_candidato || '').trim();",
          `const idCandidato = '${candidate.id}';`
        )
        .replace(
          "where e.data_evento >= current_date - interval '90 days'",
          `where e.id_candidato = '${candidate.id}' and e.data_evento >= current_date - interval '90 days'`
        )
        .replace(
          "where p.data_confirmacao >= current_date - interval '90 days'",
          `where p.id_candidato = '${candidate.id}' and p.data_confirmacao >= current_date - interval '90 days'`
        );
    case "07":
      return templateContent
        .replace(
          "07_qrcode_canais_agentes_brunex",
          `07_qrcode_canais_agentes_${candidate.slug_underscore}_${candidate.id}`
        )
        .replaceAll("Brunex", candidate.nome)
        .replaceAll("brunex", candidate.slug)
        .replaceAll("/0001/", `/${candidate.id}/`)
        .replaceAll("'0001'", `'${candidate.id}'`)
        .replaceAll("0001", candidate.id);
    default:
      throw new Error(`Prefixo de workflow nao suportado: ${prefix}`);
  }
}

function applyCommonCandidateReplacements(
  templateContent: string,
  candidate: CandidateWorkflowManifestEntry
) {
  const suffix = `${candidate.slug}_${candidate.id}`;

  return templateContent
    .replaceAll("eri_1313", suffix)
    .replaceAll("Eri 1313", `${candidate.nome} ${candidate.id}`)
    .replaceAll("Eri Castro", candidate.nome)
    .replaceAll("eri-castro", candidate.slug)
    .replaceAll("/1313/", `/${candidate.id}/`)
    .replaceAll("'1313'", `'${candidate.id}'`)
    .replaceAll(
      "cadencia_eri_1313",
      `cadencia_${candidate.slug_underscore}_${candidate.id}`
    )
    .replaceAll("cadencia_webhook_eri", `cadencia_webhook_${candidate.slug_underscore}`)
    .replaceAll("webhook_inbound_meta_eri", `webhook_inbound_meta_${candidate.slug_underscore}`)
    .replaceAll(
      "webhook_outbound_meta_eri",
      `webhook_outbound_meta_${candidate.slug_underscore}`
    )
    .replaceAll("1313", candidate.id);
}

function applyDatafyCandidateReplacements(
  templateContent: string,
  candidate: CandidateWorkflowManifestEntry
) {
  const targetName = `02b_funil_eleitor_${candidate.slug}_${candidate.id}_datafy-chat`;
  const candidateNameLower = candidate.nome.toLowerCase();
  const genericIncrementalBlock = [
    "'DETALHAMENTO INCREMENTAL DO CANDIDATO - EDITAVEL NO WORKFLOW, SEM ALTERAR O BANCO:',",
    "'Use este bloco apenas como complemento manual. Para este candidato, priorize perfil_markdown, prompts_agentes e dados da base. Nunca invente propostas, links, apoios ou realizacoes.',",
    `'ROTEIRO INICIAL: no primeiro contato, apresente-se como Atendente Virtual de ${candidate.nome} e pergunte o nome do eleitor. Depois de receber o nome, ofereca as opcoes: 1 - Conhecer ${candidate.nome} 2 - Acompanhar o trabalho 3 - Redes sociais 4 - Falar comigo 5 - Receber materiais.',`,
    "'Quando faltar informacao sobre uma proposta, diga que a proposta ainda esta sendo consolidada com a populacao.',",
    "'ABERTURA DO DIA:',"
  ].join("\\n");

  return templateContent
    .replace(/'DETALHAMENTO INCREMENTAL DO CANDIDATO[\s\S]*?'ABERTURA DO DIA:',/, genericIncrementalBlock)
    .replaceAll("02b_funil_eleitor_ricardo-vale_ricardo-vale_datafy-chat", targetName)
    .replaceAll("Webhook Entrada Ricardo Vale Datafy POST", `Webhook Entrada ${candidate.nome} Datafy POST`)
    .replaceAll("agente-politico/ricardo-vale/entrada-eleitor-datafy", `agente-politico/${candidate.id}/entrada-eleitor-datafy`)
    .replaceAll("agente-politico-ricardo-vale-entrada-eleitor-datafy-post", `agente-politico-${candidate.id}-entrada-eleitor-datafy-post`)
    .replaceAll("Postgres_Buscar_Contexto_Datafy_Ricardo", `Postgres_Buscar_Contexto_Datafy_${candidate.slug_underscore}`)
    .replaceAll("Merge_Contexto_Datafy_Ricardo", `Merge_Contexto_Datafy_${candidate.slug_underscore}`)
    .replaceAll("webhook_inbound_datafy_ricardo_vale", `webhook_inbound_datafy_${candidate.slug_underscore}`)
    .replaceAll("webhook_outbound_datafy_ricardo_vale", `webhook_outbound_datafy_${candidate.slug_underscore}`)
    .replace(/quem.{1,4}ricardo vale/g, `quem e ${candidateNameLower}`)
    .replaceAll("fala do ricardo", `fala de ${candidateNameLower}`)
    .replaceAll("fala de ricardo vale", `fala de ${candidateNameLower}`)
    .replaceAll("me fala do ricardo", `me fala de ${candidateNameLower}`)
    .replaceAll("me fala de ricardo vale", `me fala de ${candidateNameLower}`)
    .replace(
      /'13\. Nunca responda que o Instagram[\s\S]*?ricardovaledf\/.',/,
      "'13. Quando perguntarem por redes sociais, responda apenas com links ou perfis que estejam no perfil, prompts ou dados cadastrados do candidato. Se nao houver link cadastrado, diga que a equipe esta atualizando os canais oficiais.',"
    )
    .replaceAll("Ricardo Vale", candidate.nome)
    .replaceAll("ricardo-vale", candidate.id)
    .replaceAll("ricardo_vale", candidate.slug_underscore);
}

function normalizeForSlug(value: string) {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}
