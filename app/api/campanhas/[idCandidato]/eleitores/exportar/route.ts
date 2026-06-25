import { NextResponse } from "next/server";
import { getCurrentPlatformSession, hasCampaignAccess } from "@/lib/auth";
import { toCsv } from "@/lib/csv";
import { db } from "@/lib/db";
import { recordGovernanceEvent } from "@/lib/repositories/governance";

type RouteContext = {
  params: Promise<{
    idCandidato: string;
  }>;
};

type ExportField = "nome" | "telefone" | "email" | "ultima_interacao";

const FIELD_DEFINITIONS: Record<ExportField, { label: string; expression: string }> = {
  nome: {
    label: "nome",
    expression: "e.nome"
  },
  telefone: {
    label: "telefone",
    expression: "e.telefone"
  },
  email: {
    label: "email",
    expression: "e.email"
  },
  ultima_interacao: {
    label: "data_ultima_interacao",
    expression: "coalesce(last_interaction.ultima_interacao_em, e.ultimo_contato_em, e.ultima_resposta_em, e.atualizado_em, e.criado_em)::text"
  }
};

const DEFAULT_FIELDS: ExportField[] = ["nome", "telefone", "email", "ultima_interacao"];

export async function GET(request: Request, context: RouteContext) {
  const { idCandidato } = await context.params;
  const session = await getCurrentPlatformSession();
  const hasAccess = await hasCampaignAccess(session, idCandidato, "pode_visualizar");
  const canExport =
    hasAccess && (session?.perfil === "administrador" || session?.perfil === "gestor_campanha");

  if (!canExport) {
    await recordGovernanceEvent({
      idCandidato,
      escopo: "campanha",
      ator: session?.email ?? "operacao_campanha",
      categoria: "exportacao",
      acao: "exportacao_eleitores_negada",
      descricao: "Tentativa de exportacao da base de eleitores bloqueada por perfil sem autorizacao.",
      status: "erro",
      origem: "campaign-voters-export"
    });

    return NextResponse.json(
      {
        message: "Acesso nao autorizado para exportar a base de eleitores."
      },
      { status: 401 }
    );
  }

  const url = new URL(request.url);
  const fields = parseFields(url.searchParams.getAll("campo"));
  const selectedDefinitions = fields.map((field) => FIELD_DEFINITIONS[field]);
  const selectExpressions = selectedDefinitions.map(
    (definition, index) => definition.expression + " as campo_" + index
  );

  const result = await db.query<Record<string, string | null>>(
    [
      "select",
      selectExpressions.map((expression) => "  " + expression).join(",\n"),
      "from eleitores e",
      "left join lateral (",
      "  select max(i.criado_em) as ultima_interacao_em",
      "  from interacoes i",
      "  where i.eleitor_uid = e.eleitor_uid",
      "    and i.id_candidato = e.id_candidato",
      ") last_interaction on true",
      "where e.id_candidato = $1",
      "order by coalesce(last_interaction.ultima_interacao_em, e.ultimo_contato_em, e.ultima_resposta_em, e.atualizado_em, e.criado_em) desc"
    ].join("\n"),
    [idCandidato]
  );

  const rows: Array<Array<string | number | null | undefined>> = [
    selectedDefinitions.map((definition) => definition.label)
  ];

  result.rows.forEach((row) => {
    rows.push(fields.map((_field, index) => row["campo_" + index]));
  });

  const csv = toCsv(rows);

  await recordGovernanceEvent({
    idCandidato,
    escopo: "campanha",
    ator: session?.email ?? "operacao_campanha",
    categoria: "exportacao",
    acao: "exportacao_eleitores_concluida",
    descricao: "Exportacao da base de eleitores concluida pela Area do Gestor.",
    status: "sucesso",
    origem: "campaign-voters-export",
    detalhes: {
      campos: fields,
      total_registros: result.rows.length
    }
  });

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="eleitores-${idCandidato}.csv"`
    }
  });
}

function parseFields(values: string[]) {
  const allowed = new Set(Object.keys(FIELD_DEFINITIONS) as ExportField[]);
  const fields = values.filter((value): value is ExportField => allowed.has(value as ExportField));
  return fields.length ? Array.from(new Set(fields)) : DEFAULT_FIELDS;
}
