import { NextResponse } from "next/server";
import { toCsv } from "@/lib/csv";
import { getAdminCampaignStatsSnapshot } from "@/lib/repositories/campaign-analytics";
import { recordGovernanceEvent } from "@/lib/repositories/governance";

export async function GET() {
  const snapshot = await getAdminCampaignStatsSnapshot();

  const rows: Array<Array<string | number | null | undefined>> = [
    ["secao", "campo", "valor"],
    ["totais", "campanhas", snapshot.totais.campanhas],
    ["totais", "eleitores", snapshot.totais.eleitores],
    ["totais", "interacoes", snapshot.totais.interacoes],
    ["totais", "apoiadores", snapshot.totais.apoiadores],
    ["totais", "interacoes_24h", snapshot.totais.interacoes_24h],
    [],
    [
      "campanhas",
      "id_candidato",
      "nome_urna",
      "nome_campanha",
      "status_campanha",
      "total_eleitores",
      "leads_engajados",
      "apoiadores",
      "interacoes_total",
      "interacoes_24h",
      "taxa_conversao_percentual",
      "meta_contatos_percentual",
      "meta_conversao_percentual"
    ]
  ];

  snapshot.campanhas.forEach((campaign) => {
    rows.push([
      "campanhas",
      campaign.id_candidato,
      campaign.nome_urna,
      campaign.nome_campanha,
      campaign.status_campanha,
      campaign.total_eleitores,
      campaign.leads_engajados,
      campaign.apoiadores,
      campaign.interacoes_total,
      campaign.interacoes_24h,
      campaign.taxa_conversao_percentual,
      campaign.meta_contatos_percentual,
      campaign.meta_conversao_percentual
    ]);
  });

  rows.push([], ["rankings", "tipo", "id_candidato", "nome_urna", "valor", "rotulo"]);

  Object.entries(snapshot.rankings).forEach(([tipo, items]) => {
    items.forEach((item) => {
      rows.push(["rankings", tipo, item.id_candidato, item.nome_urna, item.valor, item.rotulo]);
    });
  });

  const csv = toCsv(rows);

  await recordGovernanceEvent({
    escopo: "admin",
    ator: "administrador",
    categoria: "exportacao",
    acao: "exportacao_admin_concluida",
    descricao: "Exportação executiva consolidada do admin concluída com sucesso.",
    status: "sucesso",
    origem: "admin-export",
    detalhes: {
      campanhas: snapshot.campanhas.length,
      interacoes_24h: snapshot.totais.interacoes_24h
    }
  });

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="estatisticas-admin-executivo.csv"'
    }
  });
}
