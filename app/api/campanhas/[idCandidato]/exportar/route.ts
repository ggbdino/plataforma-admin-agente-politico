import { NextResponse } from "next/server";
import { getCurrentPlatformSession, hasCampaignAccess } from "@/lib/auth";
import { toXlsxWorkbook, xlsxHeaders } from "@/lib/xlsx";
import { getCampaignAnalyticsSnapshot } from "@/lib/repositories/campaign-analytics";
import { recordGovernanceEvent } from "@/lib/repositories/governance";

type RouteContext = {
  params: Promise<{
    idCandidato: string;
  }>;
};

export async function GET(request: Request, context: RouteContext) {
  const { idCandidato } = await context.params;
  const session = await getCurrentPlatformSession();
  const hasAccess = await hasCampaignAccess(session, idCandidato, "pode_ver_kpis");
  const canExport =
    hasAccess && (session?.perfil === "administrador" || session?.perfil === "gestor_campanha");

  if (!canExport) {
    await recordGovernanceEvent({
      idCandidato,
      escopo: "campanha",
      ator: session?.email ?? "operacao_campanha",
      categoria: "exportacao",
      acao: "exportacao_negada",
      descricao: "Tentativa de exportaÃ§Ã£o executiva bloqueada por acesso operacional ausente.",
      status: "erro",
      origem: "campaign-export"
    });

    return NextResponse.json(
      {
        message: "Acesso operacional nÃ£o autorizado para exportaÃ§Ã£o."
      },
      { status: 401 }
    );
  }

  const url = new URL(request.url);
  const periodDays = parsePeriodDays(url.searchParams.get("periodo"));
  const snapshot = await getCampaignAnalyticsSnapshot(idCandidato, periodDays);

  if (!snapshot) {
    await recordGovernanceEvent({
      idCandidato,
      escopo: "campanha",
      ator: session?.email ?? "operacao_campanha",
      categoria: "exportacao",
      acao: "exportacao_sem_campanha",
      descricao: "ExportaÃ§Ã£o executiva abortada porque a campanha nÃ£o foi encontrada.",
      status: "erro",
      origem: "campaign-export"
    });

    return NextResponse.json(
      {
        message: "Campanha nÃ£o encontrada."
      },
      { status: 404 }
    );
  }

  const rows: Array<Array<string | number | null | undefined>> = [
    ["secao", "campo", "valor"],
    ["cabecalho", "id_candidato", snapshot.cabecalho.id_candidato],
    ["cabecalho", "nome_urna", snapshot.cabecalho.nome_urna],
    ["cabecalho", "nome_campanha", snapshot.cabecalho.nome_campanha],
    ["cabecalho", "status_campanha", snapshot.cabecalho.status_campanha],
    ["cabecalho", "numero_agente_oficial", snapshot.cabecalho.numero_agente_oficial],
    ["periodo", "dias", snapshot.periodoSelecionadoDias],
    ["resumo", "total_eleitores", snapshot.resumo.total_eleitores],
    ["resumo", "leads_novos", snapshot.resumo.leads_novos],
    ["resumo", "leads_qualificados", snapshot.resumo.leads_qualificados],
    ["resumo", "leads_engajados", snapshot.resumo.leads_engajados],
    ["resumo", "apoiadores", snapshot.resumo.apoiadores],
    ["resumo", "indecisos", snapshot.resumo.indecisos],
    ["resumo", "interacoes_total", snapshot.resumo.interacoes_total],
    ["resumo", "interacoes_24h", snapshot.resumo.interacoes_24h],
    ["resumo", "taxa_conversao_percentual", snapshot.resumo.taxa_conversao_percentual],
    ["periodo", "novos_leads_periodo", snapshot.resumoPeriodo.novos_leads_periodo],
    ["periodo", "interacoes_periodo", snapshot.resumoPeriodo.interacoes_periodo],
    ["periodo", "inbound_periodo", snapshot.resumoPeriodo.inbound_periodo],
    ["periodo", "outbound_periodo", snapshot.resumoPeriodo.outbound_periodo],
    ["periodo", "apoiadores_periodo", snapshot.resumoPeriodo.apoiadores_periodo],
    ["periodo", "conversao_periodo_percentual", snapshot.resumoPeriodo.conversao_periodo_percentual],
    ["metas", "meta_contatos_whatsapp", snapshot.metas.meta_contatos_whatsapp],
    ["metas", "base_total_atual", snapshot.metas.base_total_atual],
    ["metas", "gap_contatos", snapshot.metas.gap_contatos],
    ["metas", "realizado_contatos_percentual", snapshot.metas.realizado_contatos_percentual],
    ["metas", "meta_conversao_votos", snapshot.metas.meta_conversao_votos],
    ["metas", "apoiadores_atuais", snapshot.metas.apoiadores_atuais],
    ["metas", "gap_conversao", snapshot.metas.gap_conversao],
    ["metas", "realizado_conversao_percentual", snapshot.metas.realizado_conversao_percentual],
    [],
    ["funil", "etapa_funil", "total"]
  ];

  snapshot.funil.forEach((item) => {
    rows.push(["funil", item.etapa_funil, item.total]);
  });

  rows.push([], ["origens", "origem_captacao", "total"]);

  snapshot.origens.forEach((item) => {
    rows.push(["origens", item.origem_captacao, item.total]);
  });

  rows.push([], ["temas", "tema", "total"]);

  snapshot.temas.forEach((item) => {
    rows.push(["temas", item.tema, item.total]);
  });

  rows.push([], ["territorio_uf", "uf", "total", "apoiadores", "taxa_conversao_percentual", "cidades_mapeadas"]);

  snapshot.distribuicaoRegional.forEach((item) => {
    rows.push([
      "territorio_uf",
      item.uf,
      item.total,
      item.apoiadores,
      item.taxa_conversao_percentual,
      item.cidades_mapeadas
    ]);
  });

  rows.push([], ["territorio_cidades", "uf", "cidade", "total"]);

  snapshot.distribuicaoCidades.forEach((item) => {
    rows.push(["territorio_cidades", item.uf, item.cidade, item.total]);
  });

  rows.push([], ["qualidade", "campo", "valor"]);
  rows.push(["qualidade", "uf_invalidas", snapshot.qualidade.uf_invalidas]);

  rows.push([], ["conversas_estatisticas", "campo", "valor"]);
  rows.push(["conversas_estatisticas", "interacoes_total", snapshot.resumo.interacoes_total]);
  rows.push(["conversas_estatisticas", "interacoes_24h", snapshot.resumo.interacoes_24h]);
  rows.push(["conversas_estatisticas", "inbound_total", snapshot.resumo.inbound_total]);
  rows.push(["conversas_estatisticas", "outbound_total", snapshot.resumo.outbound_total]);
  rows.push(["conversas_estatisticas", "interacoes_periodo", snapshot.resumoPeriodo.interacoes_periodo]);
  rows.push(["conversas_estatisticas", "inbound_periodo", snapshot.resumoPeriodo.inbound_periodo]);
  rows.push(["conversas_estatisticas", "outbound_periodo", snapshot.resumoPeriodo.outbound_periodo]);
  rows.push([
    "conversas_estatisticas",
    "temas_monitorados",
    snapshot.temas.reduce((acc, item) => acc + item.total, 0)
  ]);
  rows.push(["conversas_estatisticas", "temas_distintos", snapshot.temas.length]);

  const spreadsheet = toXlsxWorkbook(rows);

  await recordGovernanceEvent({
    idCandidato,
    escopo: "campanha",
    ator: session?.email ?? "operacao_campanha",
    categoria: "exportacao",
    acao: "exportacao_concluida",
    descricao: `ExportaÃ§Ã£o executiva da campanha concluÃ­da para o recorte de ${periodDays} dias.`,
    status: "sucesso",
    origem: "campaign-export",
    detalhes: {
      periodo_dias: periodDays,
      total_conversas: snapshot.resumo.interacoes_total,
      temas_exportados: snapshot.temas.length
    }
  });

  return new NextResponse(spreadsheet, {
    status: 200,
    headers: xlsxHeaders(`campanha-${idCandidato}-executivo-${periodDays}d.xlsx`)
  });
}

function parsePeriodDays(value: string | null) {
  if (value === "7") {
    return 7;
  }

  if (value === "30") {
    return 30;
  }

  return 14;
}
